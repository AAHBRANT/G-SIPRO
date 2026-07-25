import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import {
  intelligenceNotificationDraftSchema,
  type IntelligenceNotificationDraft,
} from "../domain/intelligence-notification";

export async function enqueueIntelligenceNotifications(
  transaction: Prisma.TransactionClient,
  drafts: readonly IntelligenceNotificationDraft[],
  correlationId: string,
) {
  for (const input of drafts) {
    const draft = intelligenceNotificationDraftSchema.parse(input);
    const eventKey = [
      draft.type,
      draft.opportunityId,
      draft.analysisId ?? "NO_ANALYSIS",
      draft.recipientId,
    ].join(":");
    await transaction.notificationOutboxEvent.upsert({
      where: { eventKey },
      update: {},
      create: {
        id: randomUUID(),
        eventKey,
        type: draft.type,
        opportunityId: draft.opportunityId,
        analysisId: draft.analysisId,
        recipientId: draft.recipientId,
        summary: draft.summary,
        nextAction: draft.nextAction,
        deepLink: draft.deepLink,
        payload: {
          opportunityCode: draft.opportunityCode,
          analysisVersion: draft.analysisVersion ?? null,
          recommendation: draft.recommendation ?? null,
          status: draft.status ?? null,
        },
        correlationId,
      },
    });
  }
}
