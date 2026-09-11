import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { ResourceNotFoundError } from "@/core/errors/application-error";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { MicrosoftGraphNotificationProvider } from "@/modules/opportunity-intelligence/infrastructure/microsoft-graph-notification-provider";

const provider = new MicrosoftGraphNotificationProvider();

const commandSchema = z.object({
  recipientId: z.string().uuid(),
  note: z.string().trim().max(400).optional(),
}).strict();

/**
 * Compartilha uma licitação rastreada com outra pessoa da equipe, pelo Teams
 * (e por e-mail, de reforço — a mesma redundância que o dispatcher de
 * inteligência já usa: uma pessoa sem o Teams instalado ainda recebe algo).
 *
 * Não passa pela fila de eventos (`notification_outbox_events`): aquela é
 * amarrada a uma Oportunidade de verdade (`opportunityId` obrigatório) e a um
 * conjunto fechado de tipos de inteligência — encaixar uma licitação ainda
 * não aprovada ali pediria afrouxar um schema pensado pra outra coisa. Isto
 * aqui é uma ação pontual, disparada por uma pessoa, não um evento de negócio
 * recorrente: sem retentativa automática — se falhar, quem compartilhou vê o
 * erro e tenta de novo.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      const authorization = await requirePermission("opportunities.read");
      const { id } = await params;
      const command = commandSchema.parse(await request.json());

      const tender = await getDatabase().scoutedTender.findUnique({
        where: { id },
        select: { id: true, subject: true, authorityName: true },
      });
      if (!tender) return toApiError(new ResourceNotFoundError("Licitação rastreada não encontrada."));

      const recipient = await getDatabase().user.findUnique({
        where: { id: command.recipientId },
        select: { id: true, email: true, displayName: true, status: true, teamsProvisioningStatus: true },
      });
      if (!recipient || recipient.status !== "ACTIVE") {
        return toApiError(new ResourceNotFoundError("Destinatário não encontrado ou inativo."));
      }

      const eventId = randomUUID();
      const deepLink = `/opportunities/scouted#${tender.id}`;
      const message = {
        recipientEmail: recipient.email,
        recipientTeamsStatus: recipient.teamsProvisioningStatus,
        summary: command.note
          ? `${authorization.actorId === recipient.id ? "Você" : "Alguém"} compartilhou: "${tender.subject.slice(0, 160)}" — ${command.note.slice(0, 200)}`
          : `Licitação compartilhada: ${tender.subject.slice(0, 160)} (${tender.authorityName})`,
        nextAction: "Abrir a licitação no Buscador",
        deepLink,
        eventId,
      };

      const [teams, email] = await Promise.all([provider.sendTeams(message), provider.sendEmail(message)]);

      await getDatabase().auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId: authorization.actorId,
          action: "SCOUTED_TENDER_SHARED",
          entityType: "SCOUTED_TENDER",
          entityId: tender.id,
          correlationId: context.correlationId,
          outcome: teams.status === "ACCEPTED" || email.status === "ACCEPTED" ? "SUCCESS" : "FAILURE",
          origin: "scouting-share",
          metadata: {
            recipientId: recipient.id,
            teamsStatus: teams.status,
            emailStatus: email.status,
            hasNote: Boolean(command.note),
          },
        },
      });

      return NextResponse.json({
        data: { teams: teams.status, email: email.status },
        correlationId: context.correlationId,
      });
    } catch (error) {
      return toApiError(error);
    }
  });
}
