import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import { supportTicketInputSchema, type SupportDiagnosis, type SupportTicketInput } from "@/modules/support/domain/support-ticket";
import { supportApprovalPolicy } from "@/modules/support/domain/support-triage-policy";
import { CentralIaSupportProvider } from "@/modules/support/infrastructure/central-ia-support-provider";

/**
 * Diagnóstico determinístico usado quando a inteligência não responde. Mantém o
 * chamado avançando em vez de deixá-lo preso: prefere-se triagem genérica a
 * chamado parado.
 */
export function fallbackDiagnosis(input: SupportTicketInput): SupportDiagnosis {
  const feature = input.type === "NEW_FEATURE" || input.type === "IMPROVEMENT";
  return {
    summary: "Solicitação registrada e aguardando aprofundamento técnico.",
    probableCause: input.type === "BUG" ? "A causa será confirmada com os registros técnicos e a reprodução do comportamento." : "Não se aplica até a avaliação funcional.",
    severity: input.priority === "CRITICAL" ? "CRITICAL" : input.priority === "HIGH" ? "HIGH" : "MEDIUM",
    changeClass: input.type === "NEW_FEATURE" ? "NEW_TOOL" : feature ? "FUNCTIONAL_CHANGE" : "CORRECTION",
    requiredActor: "AI",
    ownerActionCategory: null,
    requiredAction: null,
    securityGuidance: null,
    recommendedAction: feature ? "Avaliar escopo, impacto e critérios de aceite antes da execução." : "Reproduzir, corrigir a causa mínima e executar testes de regressão.",
    suggestedTests: ["Reproduzir o cenário informado", "Validar o fluxo corrigido", "Executar testes de regressão relacionados"],
    userGuidance: "Acompanhe este chamado; as próximas atualizações serão registradas aqui.",
    confidence: 0.35,
  };
}

/** Nota registrada no histórico do chamado conforme a origem do diagnóstico. */
export function triageNote(hasExternalBlocker: boolean, model: string | undefined): string {
  if (hasExternalBlocker) return "A triagem identificou imediatamente uma ação exclusiva do proprietário. O chamado foi direcionado sem consumir tentativas automáticas.";
  return model ? "Triagem assistida por inteligência concluída." : "Triagem inicial concluída; diagnóstico técnico detalhado ainda será realizado.";
}

export type TriageOutcome = {
  ticketId: string;
  status: string;
  approvalRequired: boolean;
  model: string | undefined;
};

/**
 * Aplica a triagem assistida a um chamado já persistido.
 *
 * A triagem roda **fora** do ciclo de requisição da criação do chamado: o
 * modelo local pode levar minutos por resposta, e prender o navegador do
 * usuário nesse tempo é inaceitável. Ver `after()` na rota de criação e a
 * rota de dispatch, que é a rede de segurança.
 *
 * Só grava se o chamado ainda estiver aguardando triagem (`aiDiagnosedAt`
 * nulo), o que torna a operação idempotente — a rede de segurança pode
 * reprocessar sem duplicar histórico nem sobrescrever diagnóstico já feito.
 */
export class SupportTriageService {
  constructor(private readonly provider = new CentralIaSupportProvider()) {}

  async triageTicket(ticketId: string, correlationId: string): Promise<TriageOutcome | undefined> {
    const database = getDatabase();
    const ticket = await database.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.status !== "OPEN" || ticket.aiDiagnosedAt) return undefined;

    const input = supportTicketInputSchema.parse({
      type: ticket.type,
      priority: ticket.priority,
      title: ticket.title,
      description: ticket.description,
      pagePath: ticket.pagePath ?? undefined,
      errorMessage: ticket.errorMessage ?? undefined,
      stepsToReproduce: ticket.stepsToReproduce ?? undefined,
      clientContext: (ticket.clientContext as Record<string, string> | null) ?? undefined,
    });

    let diagnosis: SupportDiagnosis;
    let model: string | undefined;
    try {
      diagnosis = await this.provider.diagnose(input, correlationId);
      model = this.provider.modelName;
    } catch {
      diagnosis = fallbackDiagnosis(input);
    }

    const { approvalRequired, approvalReason, status, externalBlocker } = supportApprovalPolicy(input, diagnosis);
    const applied = await database.$transaction(async transaction => {
      const triagedAt = new Date();
      // A condição de status/aiDiagnosedAt no updateMany é a trava de
      // concorrência: se outro processo triou nesse meio-tempo, count = 0.
      const updated = await transaction.supportTicket.updateMany({
        where: { id: ticketId, status: "OPEN", aiDiagnosedAt: null },
        data: {
          status,
          aiDiagnosis: diagnosis,
          aiProviderModel: model,
          aiDiagnosedAt: triagedAt,
          approvalRequired,
          approvalReason,
          priority: diagnosis.severity === "CRITICAL" ? "CRITICAL" : input.priority,
          externalBlocker: externalBlocker ? { ...externalBlocker, reportedAt: triagedAt.toISOString() } : undefined,
          ownerActionRequiredAt: externalBlocker ? triagedAt : undefined,
        },
      });
      if (updated.count !== 1) return false;

      await transaction.supportTicketUpdate.create({
        data: {
          id: randomUUID(),
          ticketId,
          fromStatus: "OPEN",
          toStatus: status,
          note: triageNote(Boolean(externalBlocker), model),
          createdById: ticket.reporterId,
          actorLabel: externalBlocker ? "Triagem inteligente" : "Triagem automática",
        },
      });
      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: model ? "APPLICATION" : "SYSTEM",
          actorId: model ? "central-ia-support-triage" : "support-fallback-triage",
          action: externalBlocker ? "SUPPORT_OWNER_ACTION_REQUIRED" : "SUPPORT_TICKET_TRIAGED",
          entityType: "SUPPORT_TICKET",
          entityId: ticketId,
          correlationId,
          outcome: "SUCCESS",
          origin: "support-triage",
          metadata: { approvalRequired, changeClass: diagnosis.changeClass, requiredActor: diagnosis.requiredActor, model: model ?? null },
        },
      });
      return true;
    });

    if (!applied) return undefined;
    return { ticketId, status, approvalRequired, model };
  }

  /**
   * Rede de segurança: reprocessa chamados que ficaram sem triagem, por
   * exemplo se o contêiner reiniciou durante o `after()` da criação.
   */
  async dispatchPending(limit: number): Promise<TriageOutcome[]> {
    const pending = await getDatabase().supportTicket.findMany({
      where: { status: "OPEN", aiDiagnosedAt: null },
      select: { id: true, correlationId: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    const results: TriageOutcome[] = [];
    for (const ticket of pending) {
      const outcome = await this.triageTicket(ticket.id, ticket.correlationId ?? randomUUID());
      if (outcome) results.push(outcome);
    }
    return results;
  }
}
