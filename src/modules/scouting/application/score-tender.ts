import type { Prisma } from "@/generated/prisma/client";
import { computeAdherence, type AdherenceInput } from "@/modules/scouting/domain/adherence";
import { computeArchiveAdherence, type ArchiveEvidence } from "@/modules/scouting/domain/archive-adherence";
import { combineAdherence } from "@/modules/scouting/domain/combined-adherence";
import { buildPrerequisites, summarize } from "@/modules/scouting/domain/prerequisites";
import { toArchiveRequirement } from "@/modules/scouting/domain/edital-requirement";
import { editalReadingFromRow } from "@/modules/scouting/infrastructure/prisma-edital-reading";
import type { ScoutFilter } from "@/modules/scouting/domain/scout-filter";
import { themeVariants } from "@/modules/scouting/domain/signal";

export type ScoutedTenderRow = Prisma.ScoutedTenderGetPayload<{ include: { signal: true; editalReading: true } }>;

/**
 * Extraído de `opportunities/scouted/page.tsx` (22/09/2026 → hoje): a mesma
 * conta que a fila inteira faz, linha a linha, só que chamável para UMA
 * licitação. Existe porque o mapa da Análise precisa do pacote completo de
 * uma licitação só, sob pedido — sem isto, a única forma de montar os mesmos
 * dados era carregar a fila inteira.
 *
 * ⚠️ Qualquer mudança na régua de pontuação tem que valer para as duas
 * chamadas (fila e mapa) ao mesmo tempo — por isso elas chamam esta função,
 * em vez de cada uma calcular por conta própria.
 */
export function scoreTender(tender: ScoutedTenderRow, filter: ScoutFilter, archive: readonly ArchiveEvidence[], now: Date) {
  const toAdherenceInput = (row: ScoutedTenderRow): AdherenceInput => ({
    subject: row.subject,
    sphere: row.sphere,
    workTypes: row.workTypes,
    estimatedValue: row.estimatedValue === null ? undefined : Number(row.estimatedValue),
    valueUndisclosed: row.valueUndisclosed,
    proposalClosesAt: row.proposalClosesAt ?? undefined,
  });

  const edital = tender.editalReading ? editalReadingFromRow(tender.editalReading) : undefined;
  const estimado = tender.valueUndisclosed || tender.estimatedValue === null ? undefined : Number(tender.estimatedValue);
  const lido = edital ? toArchiveRequirement(edital.requirement, estimado) : null;
  const adherenceResult = computeAdherence(toAdherenceInput(tender), filter, now);
  const archiveResult = computeArchiveAdherence(
    lido ?? {
      sources: [{ text: tender.subject }],
      ...(estimado !== undefined ? { estimatedValue: estimado } : {}),
      inferred: true,
    },
    archive,
  );
  const days = tender.proposalClosesAt ? Math.max(0, Math.ceil((tender.proposalClosesAt.getTime() - now.getTime()) / 86_400_000)) : undefined;

  const prerequisites = buildPrerequisites({
    archive: archiveResult,
    ...(days !== undefined ? { daysToClose: days } : {}),
    minimumDays: filter.minimumDaysToClose,
    ...(tender.estimatedValue !== null ? { estimatedValue: Number(tender.estimatedValue) } : {}),
    valueUndisclosed: tender.valueUndisclosed,
    ...(filter.minimumValue !== undefined ? { minimumValue: filter.minimumValue } : {}),
    ...(edital ? { edital: edital.requirement } : {}),
  });
  const resumo = summarize(prerequisites);

  return {
    ...tender,
    edital,
    signal: tender.signal ? { ...tender.signal, ...themeVariants(tender.signal.color) } : null,
    adherence: adherenceResult,
    archive: archiveResult,
    combined: combineAdherence(adherenceResult, archiveResult),
    days,
    prerequisites,
    resumo,
    score: resumo.total === 0 ? 0 : Math.round((resumo.met / resumo.total) * 100),
  };
}

export type ScoredTender = ReturnType<typeof scoreTender>;
