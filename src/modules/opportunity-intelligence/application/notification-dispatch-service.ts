import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import type { NotificationChannel, NotificationDeliveryStatus, Prisma } from "@/generated/prisma/client";
import {
  MicrosoftGraphNotificationProvider,
  type NotificationDeliveryResult,
} from "../infrastructure/microsoft-graph-notification-provider";

const deliveryStatus = (result: NotificationDeliveryResult): NotificationDeliveryStatus => result.status;

export class NotificationDispatchService {
  constructor(private readonly provider = new MicrosoftGraphNotificationProvider()) {}

  async dispatch(limit = 20) {
    const results: Array<{ id: string; status: string }> = [];
    for (let index = 0; index < Math.min(Math.max(limit, 1), 50); index += 1) {
      const event = await this.claim();
      if (!event) break;
      results.push(await this.deliver(event));
    }
    return results;
  }

  private async claim() {
    return getDatabase().$transaction(async transaction => {
      const now = new Date();
      const staleLease = new Date(now.getTime() - 10 * 60_000);
      const candidate = await transaction.notificationOutboxEvent.findFirst({
        where: {
          availableAt: { lte: now },
          OR: [
            { status: { in: ["PENDING", "RETRY"] } },
            { status: "PROCESSING", leasedAt: { lt: staleLease } },
          ],
        },
        orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      });
      if (!candidate) return null;
      const leaseId = randomUUID();
      const claimed = await transaction.notificationOutboxEvent.updateMany({
        where: { id: candidate.id, status: candidate.status, leaseId: candidate.leaseId },
        data: {
          status: "PROCESSING",
          leaseId,
          leasedAt: now,
          attempts: { increment: 1 },
        },
      });
      if (claimed.count !== 1) return null;
      return transaction.notificationOutboxEvent.findUniqueOrThrow({
        where: { id: candidate.id },
        include: {
          recipient: {
            select: {
              id: true,
              email: true,
              teamsProvisioningStatus: true,
            },
          },
          deliveries: {
            select: {
              channel: true,
              status: true,
              providerReference: true,
            },
          },
        },
      });
    });
  }

  private async deliver(event: NonNullable<Awaited<ReturnType<NotificationDispatchService["claim"]>>>) {
    await getDatabase().$transaction(async transaction => {
      await transaction.userNotification.upsert({
        where: { outboxEventId: event.id },
        update: {},
        create: {
          id: randomUUID(),
          outboxEventId: event.id,
          recipientId: event.recipientId,
          type: event.type,
          summary: event.summary,
          nextAction: event.nextAction,
          deepLink: event.deepLink,
        },
      });
      await this.saveDelivery(transaction, event.id, "PANEL", {
        status: "ACCEPTED",
        errorCode: null,
        providerReference: event.id,
      });
    });

    const message = {
      recipientEmail: event.recipient.email,
      recipientTeamsStatus: event.recipient.teamsProvisioningStatus,
      summary: event.summary,
      nextAction: event.nextAction,
      deepLink: event.deepLink,
      eventId: event.id,
    };
    const acceptedTeams = event.deliveries.find(delivery =>
      delivery.channel === "TEAMS" && delivery.status === "ACCEPTED"
    );
    const acceptedEmail = event.deliveries.find(delivery =>
      delivery.channel === "EMAIL" && delivery.status === "ACCEPTED"
    );
    const [teams, email] = await Promise.all([
      acceptedTeams
        ? Promise.resolve<NotificationDeliveryResult>({
            status: "ACCEPTED",
            errorCode: null,
            providerReference: acceptedTeams.providerReference,
          })
        : this.provider.sendTeams(message),
      acceptedEmail
        ? Promise.resolve<NotificationDeliveryResult>({
            status: "ACCEPTED",
            errorCode: null,
            providerReference: acceptedEmail.providerReference,
          })
        : this.provider.sendEmail(message),
    ]);
    const external = [teams, email];
    const needsRetry = external.some(result => result.status === "RETRY") && event.attempts < 5;
    const hasFailure = external.some(result => result.status !== "ACCEPTED");
    const status = needsRetry ? "RETRY" : hasFailure ? (event.attempts >= 5 ? "FAILED" : "PARTIAL") : "SENT";
    const errorCode = external.find(result => result.errorCode)?.errorCode ?? null;

    await getDatabase().$transaction(async transaction => {
      if (!acceptedTeams) await this.saveDelivery(transaction, event.id, "TEAMS", teams);
      if (!acceptedEmail) await this.saveDelivery(transaction, event.id, "EMAIL", email);
      await transaction.notificationOutboxEvent.update({
        where: { id: event.id, leaseId: event.leaseId! },
        data: {
          status,
          leaseId: null,
          leasedAt: null,
          lastErrorCode: errorCode,
          sentAt: status === "SENT" || status === "PARTIAL" || status === "FAILED" ? new Date() : null,
          availableAt: needsRetry
            ? new Date(Date.now() + Math.min(60, 2 ** event.attempts) * 60_000)
            : event.availableAt,
        },
      });
      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "SYSTEM",
          actorId: "notification-dispatcher",
          action: "INTELLIGENCE_NOTIFICATION_DISPATCHED",
          entityType: "NOTIFICATION_OUTBOX_EVENT",
          entityId: event.id,
          correlationId: event.correlationId,
          outcome: status === "SENT" ? "SUCCESS" : "FAILURE",
          origin: "opportunity-intelligence",
          metadata: {
            outboxStatus: status,
            teamsStatus: teams.status,
            emailStatus: email.status,
            panelStatus: "ACCEPTED",
            attempts: event.attempts,
          },
        },
      });
    });
    return { id: event.id, status };
  }

  private async saveDelivery(
    transaction: Prisma.TransactionClient,
    outboxEventId: string,
    channel: NotificationChannel,
    result: NotificationDeliveryResult,
  ) {
    const attemptedAt = new Date();
    await transaction.notificationDelivery.upsert({
      where: { outboxEventId_channel: { outboxEventId, channel } },
      update: {
        status: deliveryStatus(result),
        attempts: { increment: 1 },
        providerReference: result.providerReference,
        acceptedAt: result.status === "ACCEPTED" ? attemptedAt : null,
        attemptedAt,
        errorCode: result.errorCode,
      },
      create: {
        id: randomUUID(),
        outboxEventId,
        channel,
        status: deliveryStatus(result),
        attempts: 1,
        providerReference: result.providerReference,
        acceptedAt: result.status === "ACCEPTED" ? attemptedAt : null,
        attemptedAt,
        errorCode: result.errorCode,
      },
    });
  }
}
