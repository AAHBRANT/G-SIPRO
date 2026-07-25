import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ProposalDocumentAnalysis, type ProposalAnalysisDocument } from "@/app/proposals/proposal-document-analysis";
import { ContextDocumentUploader } from "@/components/documents/context-document-uploader";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { evaluateIntelligenceIntegrationReadiness } from "@/modules/opportunity-intelligence/domain/integration-readiness";

import {
  IntelligencePanel,
  type IntelligenceAnalysisView,
} from "./intelligence-panel";
import { OpportunityEditor, type OpportunityEditorData } from "./opportunity-editor";
import { OpportunityTabs } from "./opportunity-tabs";
import { collectRequestedServices } from "./requested-services";

const statusLabels = { DRAFT: "Rascunho", QUALIFICATION: "Em análise", ACTIVE: "Validada / em proposta", SUSPENDED: "Suspensa", CLOSED: "Encerrada" } as const;
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
}).passthrough());

function localDateTime(value: Date | null): string | undefined {
  if (!value) return undefined;
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "opportunities.read" }).allowed) notFound();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const canReadAnalytics = authorize(authorization, { permission: "analytics.read" }).allowed;
  const canCalculateAnalytics = authorize(authorization, { permission: "analytics.calculate" }).allowed;
  const canConfigureAnalytics = authorize(authorization, { permission: "analytics.configure" }).allowed;
  const canReadFinancial = authorize(authorization, { permission: "analytics.read-financial" }).allowed
    && authorize(authorization, { permission: "analytics.read-client-risk" }).allowed;
  const database = getDatabase();

  const [record, users, latestAnalysis, useCases, linkedDocuments] = await Promise.all([
    database.opportunity.findUnique({
      where: { id: id.data },
      include: {
        contractingAuthority: true,
        owner: true,
        proposals: { where: { deletedAt: null }, select: { id: true, code: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    database.user.findMany({ where: { status: "ACTIVE" }, orderBy: { displayName: "asc" } }),
    canReadAnalytics
      ? database.opportunityAnalysis.findFirst({
          where: { opportunityId: id.data },
          orderBy: { version: "desc" },
          include: {
            policy: { select: { name: true, version: true } },
            dimensions: {
              orderBy: [{ perspective: "asc" }, { dimension: "asc" }],
              include: { _count: { select: { evidences: true, pendingItems: true } } },
            },
            pendingItems: { orderBy: { createdAt: "asc" } },
            impediments: { orderBy: { detectedAt: "asc" } },
            financialStudy: { select: { summary: true, highIndebtednessRisk: true, nonPayingCustomer: true } },
            climateStudy: true,
            routeStudy: true,
          },
        })
      : Promise.resolve(null),
    database.aiUseCaseDefinition.findMany({
      where: { approval: { isNot: null }, modelVersion: { status: "ACTIVE" }, nextVersions: { none: {} } },
      select: { id: true, code: true, authorizedSources: true },
      orderBy: { version: "desc" },
    }),
    database.managedDocument.findMany({
      where: { links: { some: { entityType: "OPPORTUNITY", entityId: id.data, role: "SOURCE_DOCUMENT" } } },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: { aiExtractionExecutions: { orderBy: { startedAt: "desc" }, take: 1, include: { evidence: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!record) notFound();

  const opportunity: OpportunityEditorData = {
    id: record.id,
    code: record.code,
    origin: record.origin,
    status: record.status,
    ...(record.subject && { subject: record.subject }),
    ...(record.estimatedValue !== null && { estimatedValue: record.estimatedValue.toString() }),
    ...(record.currency && { currency: record.currency }),
    ...(record.valueSource && { valueSource: record.valueSource }),
    ...(record.contractingAuthority && { contractingAuthorityName: record.contractingAuthority.name }),
    ...(localDateTime(record.publishedAt) && { publishedAt: localDateTime(record.publishedAt) }),
    ...(localDateTime(record.deliveryAt) && { deliveryAt: localDateTime(record.deliveryAt) }),
    ...(record.datesSource && { datesSource: record.datesSource }),
    ...(record.datesTimeZone && { datesTimeZone: record.datesTimeZone }),
    ...(record.ownerId && { ownerId: record.ownerId }),
  };
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
        selectionStatus: latestAnalysis.routeStudy.selectionStatus,
        alternatives: routeAlternativesSchema.catch([]).parse(latestAnalysis.routeStudy.alternatives),
      },
    }),
  } : null;
  const integrationReadiness = canConfigureAnalytics
    ? evaluateIntelligenceIntegrationReadiness(process.env)
    : undefined;
  const documentTypes = ["EDITAL", "TERMO_REFERENCIA", "ESTUDO_TECNICO_PRELIMINAR", "ANEXO_EDITAL", "OUTRO"] as const;
  const extractionDefinitions: Partial<Record<(typeof documentTypes)[number], string>> = {};
  if (authorize(authorization, { permission: "ai.execute" }).allowed) {
    for (const type of documentTypes) {
      const useCase = useCases.find((item) => item.code === "GSIPRO_ANALISE_EDITAL_TR_ETP" && Array.isArray(item.authorizedSources) && (item.authorizedSources as Array<{ documentType?: string; requiredPermission?: string }>).some((source) => source.documentType === type && typeof source.requiredPermission === "string" && authorize(authorization, { permission: source.requiredPermission }).allowed));
      if (useCase) extractionDefinitions[type] = useCase.id;
    }
  }
  const documents: ProposalAnalysisDocument[] = linkedDocuments.map((document) => {
    const version = document.versions[0];
    const execution = version?.aiExtractionExecutions[0];
    return {
      id: document.id,
      type: document.type,
      title: document.title,
      versionId: version?.id,
      version: version?.version,
      fileHash: version?.fileHash,
      analysis: execution ? {
        id: execution.id,
        status: execution.status,
        output: execution.output,
        confidence: execution.confidence?.toString() ?? null,
        limitations: execution.limitations,
        errorMessage: execution.errorMessage,
        evidence: execution.evidence.map((item) => ({ excerpt: item.excerpt, locator: item.locator })),
      } : null,
    };
  });

  const requestedServices = collectRequestedServices(documents);
  const estimatedValue = record.estimatedValue === null
    ? "Não informado"
    : Number(record.estimatedValue).toLocaleString("pt-BR", { style: "currency", currency: record.currency ?? "BRL" });

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link className="text-sm font-bold text-brand" href="/opportunities">← Voltar às oportunidades</Link>
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{record.code}</h1>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{statusLabels[record.status]}</span>
              <span className="text-sm text-muted">Versão {record.version}</span>
            </div>
            <p className="mt-2 max-w-4xl text-sm text-slate-500">Informações essenciais, documentos exclusivos desta oportunidade e decisão de avanço.</p>
          </div>
          <OpportunityEditor
            opportunity={opportunity}
            users={users.map((user) => ({ id: user.id, name: user.displayName }))}
            canUpdate={authorize(authorization, { permission: "opportunities.update" }).allowed}
            canTransition={authorize(authorization, { permission: "opportunities.transition" }).allowed}
          />
        </div>
      </div>

      <OpportunityTabs
        summary={
          <div className="grid gap-6">
            <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
              <header className="border-b border-slate-200 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-brand">Resumo da oportunidade</p>
                <h2 className="mt-1 text-xl font-bold">Informações principais</h2>
              </header>
              <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Cliente/órgão", record.contractingAuthority?.name ?? "Não identificado"],
                  ["Responsável", record.owner?.displayName ?? "Não atribuído"],
                  ["Valor estimado", estimatedValue],
                  ["Origem", record.origin],
                  ["Publicação", record.publishedAt?.toLocaleDateString("pt-BR") ?? "Não informada"],
                  ["Entrega", record.deliveryAt?.toLocaleDateString("pt-BR") ?? "Não informada"],
                  ["Documentos", String(documents.length)],
                  ["Proposta vinculada", record.proposals[0]?.code ?? "Ainda não gerada"],
                ].map(([label, value]) => (
                  <dl className="min-h-24 bg-white p-4" key={label}>
                    <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="mt-2 text-sm font-bold text-slate-900">{value}</dd>
                  </dl>
                ))}
              </div>
              <div className="border-t border-slate-200 p-5">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Objeto</p>
                <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-700">{record.subject ?? "Não informado"}</p>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
              <header className="border-b border-slate-200 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-brand">Escopo identificado</p>
                <h2 className="mt-1 text-xl font-bold">Serviços solicitados</h2>
                <p className="mt-1 text-xs text-slate-500">Itens extraídos somente dos documentos vinculados a esta oportunidade.</p>
              </header>
              {requestedServices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                      <tr><th className="px-5 py-3">Item/serviço</th><th className="px-5 py-3">Exigência ou quantidade</th><th className="px-5 py-3">Fonte</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {requestedServices.map((service, index) => (
                        <tr key={`${service.item}-${index}`}>
                          <td className="px-5 py-4 font-semibold text-slate-800">{service.item}</td>
                          <td className="max-w-2xl whitespace-pre-wrap px-5 py-4 text-slate-600">{service.requirement}</td>
                          <td className="px-5 py-4 text-xs text-slate-500">{service.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-6 text-center text-sm text-slate-500">Nenhum serviço solicitado foi identificado nos documentos analisados.</p>
              )}
            </section>

            {canReadAnalytics && <IntelligencePanel
              analysis={analysis}
              canCalculate={canCalculateAnalytics}
              canReadFinancial={canReadFinancial}
              integrationReadiness={integrationReadiness}
              mapsEmbedKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY}
              opportunityCode={record.code}
              opportunityId={record.id}
            />}
          </div>
        }
        documents={
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand">Documentação da oportunidade</p>
                <h2 className="mt-1 text-xl font-bold">Arquivos e análises do contexto</h2>
                <p className="mt-1 text-sm text-muted">Somente os documentos desta oportunidade são considerados. Novos arquivos, revisões e retificações podem ser adicionados durante a análise.</p>
              </div>
              {record.proposals[0] && <Link className="rounded-lg border border-brand px-4 py-2 text-xs font-bold text-brand" href="/proposals">Abrir {record.proposals[0].code}</Link>}
            </div>
            {authorize(authorization, { permission: "documents.create" }).allowed && authorize(authorization, { permission: "documents.link" }).allowed && (
              <div className="mt-4">
                <ContextDocumentUploader entityType="OPPORTUNITY" entityId={record.id} ownerId={record.ownerId ?? authorization!.actorId} contextLabel={`oportunidade ${record.code}`} extractionDefinitions={extractionDefinitions}/>
              </div>
            )}
            <div className="mt-4 grid gap-4">
              {documents.map((document) => <ProposalDocumentAnalysis document={document} key={document.id}/>)}
              {documents.length === 0 && <p className="rounded-xl border border-slate-200 p-5 text-center text-sm text-slate-500">Nenhum documento vinculado a esta oportunidade.</p>}
            </div>
          </section>
        }
      />
    </main>
  );
}
