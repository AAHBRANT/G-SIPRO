import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import type { ProposalDocumentType, ProposalExtractionDefinitions } from "@/app/proposals/create-proposal-form";
import type { IntelligenceAnalysisView } from "@/app/opportunities/[id]/intelligence-panel";
import { InheritedAnalysis } from "./inherited-analysis";
import { ProposalWorkspace } from "./proposal-workspace";
import { ProposalActions } from "./proposal-actions";

const originLabels: Record<string, string> = {
  PUBLIC_TENDER: "Edital / concorrência pública",
  PRIVATE_COMPETITION: "Concorrência privada",
  DIRECT: "Proposta direta",
};

const statusLabel: Record<string, string> = {
  PREPARATION: "Em elaboração",
  REVIEW: "Em revisão",
  APPROVAL: "Em análise",
  SENT: "Entregue",
  JUDGED: "Finalizada",
  CLOSED: "Finalizada",
  FINALIZED: "Finalizada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
};

const climateMonthlySchema = z.array(z.object({
  month: z.number().int().min(1).max(12),
  precipitationMm: z.number().nonnegative(),
  averageTemperatureC: z.number().optional(),
  completeness: z.number().min(0).max(100),
}).passthrough());
const routeAlternativesSchema = z.array(z.object({
  baseId: z.uuid(),
  baseCode: z.string(),
  baseName: z.string(),
  baseLocality: z.string(),
  origin: z.object({ latitude: z.number(), longitude: z.number() }),
  condition: z.string(),
  distanceKm: z.number().optional(),
  durationHours: z.number().optional(),
  tolls: z.array(z.object({ currencyCode: z.string(), units: z.string(), nanos: z.number() })).catch([]),
}).passthrough());

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "proposals.read" }).allowed) notFound();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const database = getDatabase();
  const canReadAnalytics = authorize(authorization, { permission: "analytics.read" }).allowed;
  const canReadFinancial = authorize(authorization, { permission: "analytics.read-financial" }).allowed
    && authorize(authorization, { permission: "analytics.read-client-risk" }).allowed;

  const [record, useCases] = await Promise.all([
    database.proposal.findFirst({
      where: { id: id.data, deletedAt: null },
      include: {
        opportunity: { include: { customer: true, contractingAuthority: true, owner: true } },
      },
    }),
    database.aiUseCaseDefinition.findMany({
      where: { approval: { isNot: null }, modelVersion: { status: "ACTIVE" }, nextVersions: { none: {} } },
      select: { id: true, code: true, authorizedSources: true },
      orderBy: { version: "desc" },
    }),
  ]);
  if (!record) notFound();

  const latestAnalysis = canReadAnalytics
    ? await database.opportunityAnalysis.findFirst({
        where: { opportunityId: record.opportunityId },
        orderBy: { version: "desc" },
        include: {
          policy: { select: { name: true, version: true } },
          dimensions: {
            orderBy: [{ perspective: "asc" }, { dimension: "asc" }],
            include: { _count: { select: { evidences: true, pendingItems: true } } },
          },
          pendingItems: { orderBy: { createdAt: "asc" } },
          impediments: { orderBy: { detectedAt: "asc" } },
          decisions: { orderBy: { decidedAt: "desc" }, take: 1 },
          financialStudy: { select: { summary: true, highIndebtednessRisk: true, nonPayingCustomer: true } },
          climateStudy: true,
          routeStudy: true,
        },
      })
    : null;

  const analysis: IntelligenceAnalysisView | null = latestAnalysis ? {
    id: latestAnalysis.id,
    version: latestAnalysis.version,
    status: latestAnalysis.status,
    score: latestAnalysis.score === null ? null : Number(latestAnalysis.score),
    coverage: latestAnalysis.coverage === null ? null : Number(latestAnalysis.coverage),
    confidence: latestAnalysis.confidence === null ? null : Number(latestAnalysis.confidence),
    recommendation: latestAnalysis.recommendation,
    executiveSummary: latestAnalysis.executiveSummary,
    completedAt: latestAnalysis.completedAt?.toISOString() ?? null,
    policy: latestAnalysis.policy,
    dimensions: latestAnalysis.dimensions.map((dimension) => ({
      id: dimension.id,
      perspective: dimension.perspective,
      code: dimension.dimension,
      status: dimension.status,
      score: dimension.score === null ? null : Number(dimension.score),
      confidence: Number(dimension.confidence),
      summary: dimension.summary,
      risks: z.string().array().catch([]).parse(dimension.risks),
      pendingCount: dimension._count.pendingItems,
      evidenceCount: dimension._count.evidences,
    })),
    pendingItems: latestAnalysis.pendingItems.map((item) => ({
      id: item.id,
      description: item.description,
      reason: item.reason,
      requiredInformation: item.requiredInformation,
      status: item.status,
    })),
    impediments: latestAnalysis.impediments.map((item) => ({
      id: item.id,
      type: item.type,
      severity: item.severity,
      summary: item.summary,
      status: item.status,
    })),
    ...(latestAnalysis.decisions[0] && {
      decision: {
        id: latestAnalysis.decisions[0].id,
        decision: latestAnalysis.decisions[0].decision,
        justification: latestAnalysis.decisions[0].justification,
        decidedAt: latestAnalysis.decisions[0].decidedAt.toISOString(),
      },
    }),
    ...(latestAnalysis.financialStudy && {
      financial: {
        summary: latestAnalysis.financialStudy.summary,
        ...(canReadFinancial && {
          highIndebtednessRisk: latestAnalysis.financialStudy.highIndebtednessRisk,
          nonPayingCustomer: latestAnalysis.financialStudy.nonPayingCustomer,
        }),
      },
    }),
    ...(latestAnalysis.climateStudy && {
      climate: {
        locationLabel: latestAnalysis.climateStudy.locationLabel,
        provider: latestAnalysis.climateStudy.provider,
        workStart: latestAnalysis.climateStudy.workStart.toISOString(),
        workEnd: latestAnalysis.climateStudy.workEnd.toISOString(),
        historyStart: latestAnalysis.climateStudy.historyStart.toISOString(),
        historyEnd: latestAnalysis.climateStudy.historyEnd.toISOString(),
        dataCoverage: Number(latestAnalysis.climateStudy.dataCoverage),
        monthlySeries: climateMonthlySchema.catch([]).parse(latestAnalysis.climateStudy.monthlySeries),
      },
    }),
    ...(latestAnalysis.routeStudy && {
      route: {
        destinationLabel: latestAnalysis.routeStudy.destinationLabel,
        destinationLat: Number(latestAnalysis.routeStudy.destinationLat),
        destinationLng: Number(latestAnalysis.routeStudy.destinationLng),
        provider: latestAnalysis.routeStudy.provider,
        ...(latestAnalysis.routeStudy.selectedBaseId && { selectedBaseId: latestAnalysis.routeStudy.selectedBaseId }),
        selectionStatus: latestAnalysis.routeStudy.selectionStatus,
        alternatives: routeAlternativesSchema.catch([]).parse(latestAnalysis.routeStudy.alternatives),
      },
    }),
  } : null;

  const documentTypes: ProposalDocumentType[] = ["EDITAL", "TERMO_REFERENCIA", "ESTUDO_TECNICO_PRELIMINAR", "ANEXO_EDITAL", "OUTRO"];
  const extractionDefinitions: ProposalExtractionDefinitions = {};
  if (authorize(authorization, { permission: "ai.execute" }).allowed) {
    for (const type of documentTypes) {
      const permittedForType = (item: (typeof useCases)[number]) => Array.isArray(item.authorizedSources) && (item.authorizedSources as Array<{ documentType?: string; requiredPermission?: string }>).some((source) => source.documentType === type && typeof source.requiredPermission === "string" && authorize(authorization, { permission: source.requiredPermission }).allowed);
      const useCase = useCases.find((item) => item.code === "GSIPRO_ANALISE_EDITAL_TR_ETP" && permittedForType(item)) ?? useCases.find(permittedForType);
      if (useCase) extractionDefinitions[type] = useCase.id;
    }
  }

  const current = record.opportunity.deliveryAt && record.opportunity.deliveryAt < new Date() && !["SENT", "JUDGED", "CLOSED", "FINALIZED", "CANCELLED"].includes(record.status)
    ? "EXPIRED"
    : record.status;
  const terminal = ["FINALIZED", "JUDGED", "CLOSED"].includes(current);
  const cancelled = current === "CANCELLED";
  const client = record.opportunity.customer?.name ?? record.opportunity.contractingAuthority?.name ?? "Não informado";

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link className="text-sm font-bold text-brand" href="/proposals">← Voltar às propostas</Link>
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{record.code}</h1>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{statusLabel[current] ?? current}</span>
              <span className="text-sm text-muted">Versão {record.version}</span>
            </div>
            <p className="mt-2 max-w-4xl text-sm text-slate-500">{record.title}</p>
          </div>
          <ProposalActions
            canDelete={authorize(authorization, { permission: "proposals.delete" }).allowed}
            canManageStatus={authorize(authorization, { permission: "proposals.manage-status" }).allowed}
            cancelled={cancelled}
            proposalCode={record.code}
            proposalId={record.id}
            terminal={terminal}
          />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <header className="border-b border-slate-200 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-brand">Resumo da proposta</p>
          <h2 className="mt-1 text-xl font-bold">Informações principais</h2>
        </header>
        <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Cliente/órgão", client],
            ["Responsável", record.opportunity.owner?.displayName ?? "Não atribuído"],
            ["Tipo", originLabels[record.originType] ?? record.originType],
            ["Data de entrega", record.opportunity.deliveryAt?.toLocaleDateString("pt-BR") ?? "Não informada"],
            ["Oportunidade de origem", record.opportunity.code],
          ].map(([label, value]) => (
            <dl className="min-h-24 bg-white p-4" key={label}>
              <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-2 text-sm font-bold text-slate-900">{value}</dd>
            </dl>
          ))}
        </div>
      </section>

      {canReadAnalytics && <InheritedAnalysis analysis={analysis} opportunityCode={record.opportunity.code} />}

      <ProposalWorkspace
        canUploadDocuments={authorize(authorization, { permission: "documents.create" }).allowed && authorize(authorization, { permission: "documents.link" }).allowed}
        extractionDefinitions={extractionDefinitions}
        proposalCode={record.code}
        proposalId={record.id}
      />
    </main>
  );
}
