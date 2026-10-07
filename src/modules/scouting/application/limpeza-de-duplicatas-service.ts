import { getDatabase } from "@/core/database/prisma";
import { OpportunityService } from "@/modules/opportunities/application/opportunity-service";
import { PrismaOpportunityRepository } from "@/modules/opportunities/infrastructure/prisma-opportunity-repository";
import { TriageService } from "@/modules/scouting/application/triage-service";
import { planejarLimpeza, type PlanoDeLimpeza } from "@/modules/scouting/domain/limpeza-de-duplicatas";
import { OpportunityFromScoutedTender, PrismaTriageRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";

export type ResumoDaLicitacao = Readonly<{ id: string; subject: string; authorityName: string; city?: string | undefined; state?: string | undefined }>;

export type PrevisaoDeLimpeza = Readonly<{
  plano: PlanoDeLimpeza;
  /** Para a tela mostrar o que é cada licitação citada no plano. */
  licitacoes: ReadonlyMap<string, ResumoDaLicitacao>;
}>;

export type ResultadoDaLimpeza = Readonly<{
  licitacoesDescartadas: number;
  oportunidadesEncerradas: number;
  falhas: readonly string[];
}>;

/**
 * Monta o plano a partir do banco. Somente leitura: é o que a tela de prévia
 * mostra antes de qualquer confirmação.
 */
export async function preverLimpeza(): Promise<PrevisaoDeLimpeza> {
  const database = getDatabase();
  const [licitacoes, oportunidades, vinculadas] = await Promise.all([
    database.scoutedTender.findMany({
      where: { OR: [{ status: "PENDING" }, { status: "APPROVED", opportunityId: { not: null } }] },
      select: {
        id: true, status: true, opportunityId: true, authorityDocument: true, authorityName: true,
        processNumber: true, subject: true, proposalOpensAt: true, createdAt: true, city: true, state: true,
      },
    }),
    database.opportunity.findMany({
      where: { status: { not: "CLOSED" } },
      select: {
        id: true, code: true, status: true, origin: true, subject: true, contractingAuthorityId: true, createdAt: true,
        _count: { select: { proposals: true, tenders: true } },
      },
    }),
    database.scoutedTender.findMany({ where: { opportunityId: { not: null } }, select: { opportunityId: true }, distinct: ["opportunityId"] }),
  ]);
  const comLicitacao = new Set(vinculadas.map((v) => v.opportunityId));

  const plano = planejarLimpeza(
    licitacoes.map((l) => ({
      id: l.id,
      aprovada: l.status === "APPROVED",
      ...(l.opportunityId ? { opportunityId: l.opportunityId } : {}),
      ...(l.authorityDocument ? { authorityDocument: l.authorityDocument } : {}),
      authorityName: l.authorityName,
      ...(l.processNumber ? { processNumber: l.processNumber } : {}),
      subject: l.subject,
      ...(l.proposalOpensAt ? { publishedAt: l.proposalOpensAt } : {}),
      createdAt: l.createdAt,
    })),
    oportunidades.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      origin: o.origin,
      subject: o.subject ?? undefined,
      contractingAuthorityId: o.contractingAuthorityId ?? undefined,
      createdAt: o.createdAt,
      temProposta: o._count.proposals > 0,
      fichas: o._count.tenders,
      vinculada: comLicitacao.has(o.id),
    })),
  );

  return {
    plano,
    licitacoes: new Map(licitacoes.map((l) => [l.id, {
      id: l.id, subject: l.subject, authorityName: l.authorityName, city: l.city ?? undefined, state: l.state ?? undefined,
    }])),
  };
}

/**
 * Aplica o plano RECALCULADO na hora — nunca um plano antigo vindo da tela,
 * que pode ter envelhecido entre a prévia e o clique. Cada item é
 * independente: uma falha é registrada e a limpeza segue com os demais.
 */
export async function aplicarLimpeza(actorId: string, correlationId: string): Promise<ResultadoDaLimpeza> {
  const { plano } = await preverLimpeza();
  const triagem = new TriageService(new PrismaTriageRepository(), new OpportunityFromScoutedTender());
  const oportunidades = new OpportunityService(new PrismaOpportunityRepository());
  const falhas: string[] = [];
  let licitacoesDescartadas = 0;
  let oportunidadesEncerradas = 0;

  for (const [id, { sobrevivente, jaAprovada }] of plano.licitacoes) {
    try {
      await triagem.discard(id, actorId, jaAprovada
        ? `Limpeza de duplicatas: mesma obra que a licitação ${sobrevivente}, já aprovada.`
        : `Limpeza de duplicatas: mesma obra que a licitação ${sobrevivente}, publicada mais recentemente.`);
      licitacoesDescartadas += 1;
    } catch (error) {
      falhas.push(`Licitação ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const grupo of plano.grupos) {
    for (const duplicada of grupo.encerrar) {
      try {
        // Rascunho não pode ir direto para Encerrada (DRAFT → QUALIFICATION é
        // a única saída do rascunho): passa por "Em análise" antes.
        if (duplicada.status === "DRAFT") {
          await oportunidades.transition(duplicada.id, "QUALIFICATION", actorId, {}, correlationId);
        }
        await oportunidades.transition(duplicada.id, "CLOSED", actorId, {
          closureReasonCode: "OTHER",
          closureJustification: `Duplicada de ${grupo.fica.code} (mesma obra aprovada mais de uma vez no Buscador). Encerrada pela limpeza de duplicatas.`,
        }, correlationId);
        oportunidadesEncerradas += 1;
      } catch (error) {
        falhas.push(`${duplicada.code}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return { licitacoesDescartadas, oportunidadesEncerradas, falhas };
}
