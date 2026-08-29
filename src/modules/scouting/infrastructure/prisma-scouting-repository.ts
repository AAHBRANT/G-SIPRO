import { getDatabase } from "@/core/database/prisma";
import { OpportunityService } from "@/modules/opportunities/application/opportunity-service";
import { PrismaOpportunityRepository } from "@/modules/opportunities/infrastructure/prisma-opportunity-repository";
import type { QualifiedTender, ScoutRepository, ScoutRunSummary, ScoutRunTrigger } from "@/modules/scouting/application/scout-service";
import type {
  OpportunityCreationPort,
  OpportunitySeed,
  ScoutedTenderRecord,
  TriageRepository,
} from "@/modules/scouting/application/triage-service";
import type { ArchiveEvidence } from "@/modules/scouting/domain/archive-adherence";
import { fieldsFromExtractionOutput, servicesFromExtraction } from "@/modules/technical-archive/domain/extracted-services";
import type { SignalRecord, SignalRepository } from "@/modules/scouting/application/signal-service";
import { scoutFilterSchema, type ScoutFilter } from "@/modules/scouting/domain/scout-filter";

/** Registro único de configuração dos filtros. */
const FILTER_SINGLETON_ID = "00000000-0000-4000-8000-000000000001";

const VALUE_SOURCE = "PNCP — valor estimado publicado";
const DATES_SOURCE = "PNCP — encerramento do prazo de propostas";
const DATES_TIME_ZONE = "America/Sao_Paulo";

function toNumber(value: { toString(): string } | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class PrismaScoutRepository implements ScoutRepository {
  async loadFilter(): Promise<ScoutFilter | null> {
    const stored = await getDatabase().scoutFilter.findUnique({ where: { id: FILTER_SINGLETON_ID } });
    if (!stored) return null;
    return scoutFilterSchema.parse({
      includeKeywords: stored.includeKeywords,
      excludeKeywords: stored.excludeKeywords,
      workTypes: stored.workTypes,
      states: stored.states,
      spheres: stored.spheres,
      minimumValue: toNumber(stored.minimumValue),
      maximumValue: toNumber(stored.maximumValue),
      minimumDaysToClose: stored.minimumDaysToClose,
      includeUndisclosedValue: stored.includeUndisclosedValue,
      conditionTreatments: stored.conditionTreatments ?? {},
    });
  }

  async saveFilter(filter: ScoutFilter, actorId: string): Promise<void> {
    const data = {
      includeKeywords: [...filter.includeKeywords],
      excludeKeywords: [...filter.excludeKeywords],
      workTypes: [...filter.workTypes],
      states: [...filter.states],
      spheres: [...filter.spheres],
      minimumValue: filter.minimumValue ?? null,
      maximumValue: filter.maximumValue ?? null,
      minimumDaysToClose: filter.minimumDaysToClose,
      includeUndisclosedValue: filter.includeUndisclosedValue,
      conditionTreatments: filter.conditionTreatments,
      updatedBy: actorId,
    };
    await getDatabase().scoutFilter.upsert({
      where: { id: FILTER_SINGLETON_ID },
      create: { id: FILTER_SINGLETON_ID, ...data },
      update: data,
    });
  }

  async startRun(trigger: ScoutRunTrigger): Promise<string> {
    const run = await getDatabase().scoutRun.create({ data: { trigger, status: "RUNNING" }, select: { id: true } });
    return run.id;
  }

  async findKnownExternalIds(externalIds: readonly string[]): Promise<readonly string[]> {
    if (externalIds.length === 0) return [];
    const found = await getDatabase().scoutedTender.findMany({
      where: { externalId: { in: [...externalIds] } },
      select: { externalId: true },
    });
    return found.map((entry) => entry.externalId);
  }

  async saveScoutedTenders(runId: string, tenders: readonly QualifiedTender[]): Promise<number> {
    const result = await getDatabase().scoutedTender.createMany({
      data: tenders.map((tender) => ({
        runId,
        externalId: tender.externalId,
        subject: tender.subject,
        authorityName: tender.authorityName,
        authorityDocument: tender.authorityDocument ?? null,
        sphere: tender.sphere,
        city: tender.city ?? null,
        state: tender.state ?? null,
        modality: tender.modality,
        workTypes: [...tender.workTypes],
        processNumber: tender.processNumber ?? null,
        estimatedValue: tender.estimatedValue ?? null,
        valueUndisclosed: tender.valueUndisclosed,
        proposalOpensAt: tender.proposalOpensAt ?? null,
        proposalClosesAt: tender.proposalClosesAt ?? null,
        noticeUrl: tender.noticeUrl ?? null,
        sourceUrl: tender.sourceUrl ?? null,
      })),
      // Corrida entre duas varreduras não pode derrubar a execução inteira.
      skipDuplicates: true,
    });
    return result.count;
  }

  async completeRun(runId: string, summary: Omit<ScoutRunSummary, "runId" | "failures">, partialReason?: string): Promise<void> {
    await getDatabase().scoutRun.update({
      where: { id: runId },
      data: { status: "COMPLETED", finishedAt: new Date(), ...summary, failureReason: partialReason ?? null },
    });
  }

  async failRun(runId: string, reason: string): Promise<void> {
    await getDatabase().scoutRun.update({
      where: { id: runId },
      data: { status: "FAILED", finishedAt: new Date(), failureReason: reason },
    });
  }

  async expireOverdue(reference: Date): Promise<number> {
    const result = await getDatabase().scoutedTender.updateMany({
      where: { status: "PENDING", proposalClosesAt: { lt: reference } },
      data: { status: "EXPIRED" },
    });
    return result.count;
  }
}

export class PrismaTriageRepository implements TriageRepository {
  async findById(id: string): Promise<ScoutedTenderRecord | null> {
    const stored = await getDatabase().scoutedTender.findUnique({ where: { id } });
    if (!stored) return null;
    return {
      id: stored.id,
      externalId: stored.externalId,
      subject: stored.subject,
      authorityName: stored.authorityName,
      authorityDocument: stored.authorityDocument ?? undefined,
      city: stored.city ?? undefined,
      state: stored.state ?? undefined,
      estimatedValue: toNumber(stored.estimatedValue),
      valueUndisclosed: stored.valueUndisclosed,
      proposalClosesAt: stored.proposalClosesAt ?? undefined,
      noticeUrl: stored.noticeUrl ?? undefined,
      status: stored.status,
    };
  }

  async markApproved(id: string, opportunityId: string, actorId: string, decidedAt: Date): Promise<void> {
    await getDatabase().scoutedTender.update({
      where: { id },
      data: { status: "APPROVED", opportunityId, decidedById: actorId, decidedAt },
    });
  }

  async markDiscarded(id: string, actorId: string, reason: string, decidedAt: Date): Promise<void> {
    await getDatabase().scoutedTender.update({
      where: { id },
      data: { status: "DISCARDED", decidedById: actorId, decisionReason: reason, decidedAt },
    });
  }

  async countPending(): Promise<number> {
    return getDatabase().scoutedTender.count({ where: { status: "PENDING" } });
  }
}

/**
 * Cria a oportunidade reutilizando o serviço já existente, para preservar a
 * numeração sequencial, o histórico e a auditoria do módulo de oportunidades.
 * A oportunidade nasce com origem BUSCADOR e status "Em análise"
 * (QUALIFICATION); o responsável é quem aprovou na triagem.
 */
export class OpportunityFromScoutedTender implements OpportunityCreationPort {
  private readonly service = new OpportunityService(new PrismaOpportunityRepository());

  async createFromScoutedTender(seed: OpportunitySeed, actorId: string, correlationId: string): Promise<string> {
    // Vincula ao órgão já cadastrado quando o nome coincide. Nunca cria órgão
    // novo: o cadastro de órgãos é dado mestre e permanece sob curadoria da
    // equipe. Sem correspondência, a oportunidade nasce sem vínculo e o nome do
    // órgão fica registrado na fila de rastreadas.
    const authority = await getDatabase().contractingAuthority.findFirst({
      where: { active: true, name: { equals: seed.authorityName, mode: "insensitive" } },
      select: { id: true },
    });

    const created = await this.service.create(
      {
        origin: "BUSCADOR",
        subject: seed.subject,
        ownerId: seed.ownerId,
        ...(authority ? { contractingAuthorityId: authority.id } : {}),
        ...(seed.estimatedValue !== undefined ? { estimatedValue: seed.estimatedValue, currency: "BRL", valueSource: VALUE_SOURCE } : {}),
        ...(seed.deliveryAt ? { deliveryAt: seed.deliveryAt, datesSource: DATES_SOURCE, datesTimeZone: DATES_TIME_ZONE } : {}),
      },
      actorId,
      correlationId,
    );

    // "Em análise" é o estado em que a equipe recebe a oportunidade.
    await this.service.transition(created.id, "QUALIFICATION", actorId, {}, correlationId);
    return created.id;
  }
}

/**
 * Sinalização da fila de triagem.
 *
 * `upsert` pela licitação, não pelo par licitação+pessoa: a marca é uma só, e
 * sinalizar de novo troca a anterior registrando o novo autor.
 */
export class PrismaSignalRepository implements SignalRepository {
  async findTenderStatus(tenderId: string): Promise<{ status: string } | null> {
    const tender = await getDatabase().scoutedTender.findUnique({ where: { id: tenderId }, select: { status: true } });
    return tender ? { status: tender.status } : null;
  }

  async save(record: SignalRecord): Promise<void> {
    const dados = {
      level: record.level,
      label: record.label,
      color: record.color,
      note: record.note ?? null,
      signaledById: record.signaledById,
    };
    await getDatabase().scoutedTenderSignal.upsert({
      where: { tenderId: record.tenderId },
      create: { tenderId: record.tenderId, ...dados, createdAt: record.signaledAt },
      update: dados,
    });
  }

  async remove(tenderId: string): Promise<boolean> {
    // deleteMany não estoura quando não há nada: a contagem devolvida é que
    // diz se existia marca, e é ela que vira o erro na camada de aplicação.
    const { count } = await getDatabase().scoutedTenderSignal.deleteMany({ where: { tenderId } });
    return count > 0;
  }
}

/**
 * Acervo técnico da empresa, no formato que o confronto da fila consome.
 *
 * ⚠️ Lê a MESMA fonte que a tela "Acervo técnico" mostra, e não a tabela de
 * contratos executados como a primeira versão fazia. A tela parte dos atestados
 * (documento do tipo ATESTADO) e, para cada um, usa os serviços estruturados se
 * existirem ou, na falta deles, os que a IA extraiu do PDF. Consultar só a
 * tabela estruturada devolvia ZERO na base real — os 2.209 serviços dos 24
 * atestados vêm da extração.
 *
 * Não há filtro por situação do contrato de propósito: acervo é o que a equipe
 * vê na tela do acervo. Se um dia a regra mudar, ela muda nos dois lugares
 * juntos, e não só aqui.
 */
export class PrismaArchiveEvidenceRepository {
  /**
   * Carrega o acervo inteiro de uma vez.
   *
   * Consultar por licitação faria uma consulta por linha — centenas numa fila
   * de centenas. O acervo é da empresa, não da licitação: muda raramente e cabe
   * folgado na memória de um pedido.
   */
  async loadEvidence(): Promise<ArchiveEvidence[]> {
    const documents = await getDatabase().managedDocument.findMany({
      where: { type: "ATESTADO", status: { not: "DELETED" } },
      select: {
        id: true,
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            technicalEvidenceRecords: {
              select: {
                experience: {
                  select: {
                    subject: true,
                    value: true,
                    services: {
                      select: {
                        id: true, discipline: true, originalDescription: true, characteristics: true,
                        quantities: { select: { value: true, unit: true } },
                      },
                    },
                  },
                },
              },
            },
            aiExtractionExecutions: { orderBy: { startedAt: "desc" }, take: 1, select: { output: true } },
          },
        },
      },
    });

    return documents.flatMap((document) => {
      const version = document.versions[0];
      if (!version) return [];

      const experience = version.technicalEvidenceRecords[0]?.experience;
      const contractSubject = experience?.subject;
      const contractValue = experience?.value === null || experience?.value === undefined ? undefined : Number(experience.value);

      // Serviço estruturado tem precedência: alguém já conferiu e organizou.
      if (experience && experience.services.length > 0) {
        return experience.services.map((service) => ({
          serviceId: service.id,
          discipline: service.discipline,
          description: service.originalDescription,
          characteristics: service.characteristics,
          // Já vem separado em valor e unidade no caminho estruturado.
          quantities: service.quantities.map((q) => `${q.value.toString()} ${q.unit}`),
          ...(contractValue !== undefined ? { contractValue } : {}),
          ...(contractSubject ? { contractSubject } : {}),
        }));
      }

      // Caso comum hoje: o que a IA leu da tabela de serviços do atestado.
      const extracted = servicesFromExtraction(fieldsFromExtractionOutput(version.aiExtractionExecutions[0]?.output));
      return extracted.map((service, index) => ({
        serviceId: `${version.id}:${index}`,
        discipline: service.discipline,
        description: service.description,
        // A extração traz quantidade e unidade juntas; elas entram como
        // característica porque é onde o confronto procura detalhe.
        characteristics: service.quantities,
        // A extração devolve quantidade e unidade num texto só, e é dele que a
        // comparação de quantitativo tira o número.
        quantities: service.quantities === "Não informada" ? [] : [service.quantities],
        ...(contractValue !== undefined ? { contractValue } : {}),
        ...(contractSubject ? { contractSubject } : {}),
      }));
    });
  }
}
