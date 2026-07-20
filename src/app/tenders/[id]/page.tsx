import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";

import { AddVersionForm } from "./add-version-form";
import { AnalysisActions } from "./analysis-actions";
import { AnalysisForm } from "./analysis-form";
import { ConfirmDeadlineForm } from "./confirm-deadline-form";
import { DeadlineForm } from "./deadline-form";
import { RequirementForm } from "./requirement-form";
import { RequirementValidationForm } from "./requirement-validation-form";
import { RectificationForm } from "./rectification-form";

const criticalityLabels = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica" } as const;
const competenceLabels = { TECHNICAL: "Técnica", LEGAL: "Jurídica", COMMERCIAL: "Comercial", FINANCIAL: "Financeira", ACCOUNTING: "Contábil" } as const;
const analysisStatusLabels = { PENDING: "Pendente", VALIDATED: "Validada", REJECTED: "Rejeitada" } as const;
const requirementStatusLabels = { DRAFT: "Rascunho", PENDING_VALIDATION: "Revalidação pendente", VALIDATED: "Validado", REJECTED: "Rejeitado" } as const;

export default async function TenderDetail({ params }: { params: Promise<{ id: string }> }) {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "tenders.read" }).allowed) notFound();
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();

  const [tender, users] = await Promise.all([
    getDatabase().tender.findUnique({
      where: { id: parsed.data },
      include: {
        lots: true,
        versions: {
          include: { attachments: true, requirements: { include: { responsible: true, analyses: { include: { assignee: true }, orderBy: { competence: "asc" } } }, orderBy: [{ criticality: "desc" }, { createdAt: "asc" }] } },
          orderBy: { version: "desc" },
        },
        opportunity: true,
        contractingAuthority: true,
        deadlines: { include: { responsible: true, alerts: true, requirement: true }, orderBy: { dueAt: "asc" } },
        rectifications: { include: { previousVersion: true, rectifiedByVersion: true, impacts: { include: { requirement: true } } }, orderBy: { createdAt: "desc" } },
      },
    }),
    getDatabase().user.findMany({ where: { status: "ACTIVE" }, orderBy: { displayName: "asc" } }),
  ]);
  if (!tender) notFound();
  const requirements = tender.versions.flatMap((version) => version.requirements.map((requirement) => ({ ...requirement, documentVersion: version.version })));

  return <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
    <div><Link className="text-sm font-bold text-brand" href="/tenders">← Voltar aos editais</Link><h1 className="mt-6 text-3xl font-bold">{tender.code} · {tender.number}</h1><p className="mt-2 text-muted">{tender.modality} · {tender.origin}</p><p className="mt-3">{tender.subject}</p></div>
    {authorize(authorization, { permission: "tenders.version" }).allowed && <AddVersionForm tenderId={tender.id} />}
    {authorize(authorization, { permission: "requirements.create" }).allowed && <RequirementForm tenderId={tender.id} versions={tender.versions.map((version) => ({ id: version.id, version: version.version, fileName: version.fileName }))} users={users.map((user) => ({ id: user.id, name: user.displayName }))} />}
    {authorize(authorization, { permission: "deadlines.create" }).allowed && <DeadlineForm tenderId={tender.id} requirements={requirements.map((requirement) => ({ id: requirement.id, label: `${requirement.type} · página ${requirement.sourcePage}` }))} users={users.map((user) => ({ id: user.id, name: user.displayName }))} />}
    {authorize(authorization, { permission: "rectifications.create" }).allowed && tender.versions.length > 1 && requirements.length > 0 && <RectificationForm tenderId={tender.id} versions={tender.versions.map((version) => ({ id: version.id, version: version.version, fileName: version.fileName }))} requirements={requirements.map((requirement) => ({ id: requirement.id, label: `${requirement.type} · versão documental ${requirement.documentVersion}` }))} />}
    <section className="rounded-2xl border border-border bg-surface p-6"><h2 className="text-xl font-bold">Retificações e impactos</h2><div className="mt-4 space-y-3">{tender.rectifications.map((rectification) => <article className="rounded-xl border border-border p-4" key={rectification.id}><div className="flex flex-wrap justify-between gap-2"><strong>Versão {rectification.previousVersion.version} → {rectification.rectifiedByVersion.version}</strong><span className="text-sm text-muted">{rectification.createdAt.toLocaleString("pt-BR")}</span></div><p className="mt-2">{rectification.description}</p><p className="mt-1 text-sm text-muted">Fonte: {rectification.source}</p><ul className="mt-3 space-y-1 text-sm">{rectification.impacts.map((impact) => <li key={impact.id}>• {impact.requirement.type}: {impact.description}{impact.requiresRevalidation ? " · revalidação exigida" : ""}</li>)}</ul></article>)}{tender.rectifications.length === 0 && <p className="py-6 text-center text-muted">Nenhuma retificação registrada.</p>}</div></section>
    <section className="rounded-2xl border border-border bg-surface p-6"><h2 className="text-xl font-bold">Prazos e alertas</h2><div className="mt-4 space-y-3">{tender.deadlines.map((deadline) => <article className="rounded-xl border border-border p-4" key={deadline.id}><div className="flex flex-wrap justify-between gap-2"><strong>{deadline.event}{deadline.critical ? " · CRÍTICO" : ""}</strong><span className="text-sm font-semibold">{deadline.status === "PENDING_CONFIRMATION" ? "Aguardando confirmação" : "Confirmado"}</span></div><p className="mt-2">{deadline.dueAt.toLocaleString("pt-BR")} · {deadline.timeZone}</p><p className="mt-1 text-sm text-muted">Fonte: {deadline.source} · Responsável: {deadline.responsible.displayName}</p><p className="mt-1 text-xs text-muted">Alertas programados: {deadline.alerts.length}</p>{deadline.status === "PENDING_CONFIRMATION" && authorize(authorization, { permission: "deadlines.confirm" }).allowed && <ConfirmDeadlineForm deadlineId={deadline.id}/>}</article>)}{tender.deadlines.length===0&&<p className="py-6 text-center text-muted">Nenhum prazo registrado.</p>}</div></section>
    <section className="rounded-2xl border border-border bg-surface p-6"><h2 className="text-xl font-bold">Requisitos e análises por competência</h2><div className="mt-4 space-y-3">{requirements.map((requirement) => <article className="rounded-xl border border-border p-4" key={requirement.id}><div className="flex flex-wrap justify-between gap-2"><strong>{requirement.type} · {criticalityLabels[requirement.criticality]}</strong><span className="text-sm text-muted">{requirementStatusLabels[requirement.status]} · versão documental {requirement.documentVersion}, página {requirement.sourcePage}</span></div><p className="mt-2">{requirement.text}</p><blockquote className="mt-3 border-l-4 border-blue-200 pl-3 text-sm text-muted">{requirement.sourceExcerpt}</blockquote><p className="mt-2 text-xs text-muted">Responsável: {requirement.responsible.displayName} · Versão do requisito: {requirement.version}</p>{requirement.analyses.length > 0 && <div className="mt-4 grid gap-3">{requirement.analyses.map((analysis) => <div className="rounded-lg bg-background p-3" key={analysis.id}><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{competenceLabels[analysis.competence]} · {analysis.priority}</strong><span>{analysisStatusLabels[analysis.status]}</span></div><p className="mt-1 text-xs text-muted">Responsável: {analysis.assignee.displayName} · Versão {analysis.version}</p>{analysis.status === "PENDING" && (authorize(authorization, { permission: "analyses.decide" }).allowed || authorize(authorization, { permission: "analyses.reassign" }).allowed) && <AnalysisActions analysisId={analysis.id} users={users.map((user) => ({ id: user.id, name: user.displayName }))}/>}</div>)}</div>}{authorize(authorization, { permission: "analyses.create" }).allowed && <AnalysisForm requirementId={requirement.id} users={users.map((user) => ({ id: user.id, name: user.displayName }))}/>} {requirement.status !== "VALIDATED" && requirement.analyses.length > 0 && requirement.analyses.every((analysis) => analysis.status === "VALIDATED") && authorize(authorization, { permission: "requirements.validate" }).allowed && <RequirementValidationForm requirementId={requirement.id} />}</article>)}{requirements.length === 0 && <p className="py-6 text-center text-muted">Nenhum requisito registrado.</p>}</div></section>
    <section className="rounded-2xl border border-border bg-surface p-6"><h2 className="text-xl font-bold">Versões imutáveis</h2><ol className="mt-4 space-y-3">{tender.versions.map((version) => <li className="rounded-xl border border-border p-4" key={version.id}><div className="flex justify-between gap-3"><strong>Versão {version.version} · {version.fileName}</strong><span className="text-sm text-muted">{version.receivedAt.toLocaleString("pt-BR")}</span></div><p className="mt-2 break-all font-mono text-xs text-muted">SHA-256: {version.fileHash}</p><p className="mt-1 text-sm">Fonte: {version.source}</p></li>)}</ol></section>
  </main>;
}
