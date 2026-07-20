import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { ComplianceMatrixService } from "@/modules/compliance-matrices/application/matrix-service";
import { PrismaComplianceMatrixRepository } from "@/modules/compliance-matrices/infrastructure/prisma-matrix-repository";
import { ItemAssessmentForm } from "./item-assessment-form";
import { MatrixEvidenceForm } from "./matrix-evidence-form";
import { MatrixExportButton } from "./matrix-export-button";
import { MatrixForm } from "./matrix-form";

const criticalityLabels: Record<string, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", CRITICAL: "Crítica" };
const decisionLabels: Record<string, string> = { MEETS: "Atende", PARTIAL: "Atende parcialmente", DOES_NOT_MEET: "Não atende", NOT_APPLICABLE: "Não aplicável" };

export default async function ComplianceMatricesPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "compliance-matrices.read" }).allowed) notFound();
  const canAssociateEvidence = authorize(authorization, { permission: "compliance-matrices.associate-evidence" }).allowed;
  const canValidateItem = authorize(authorization, { permission: "compliance-matrices.validate-item" }).allowed;
  const canFinalize = authorize(authorization, { permission: "compliance-matrices.finalize" }).allowed;
  const canExport = authorize(authorization, { permission: "compliance-matrices.export" }).allowed;
  const [matrices, tenderVersions, technicalEvidence, activeUsers] = await Promise.all([
    new ComplianceMatrixService(new PrismaComplianceMatrixRepository()).list(authorization!.actorId),
    getDatabase().tenderVersion.findMany({ include: { tender: true, requirements: { select: { status: true } } }, orderBy: [{ receivedAt: "desc" }, { version: "desc" }] }),
    canAssociateEvidence ? getDatabase().technicalEvidence.findMany({ include: { experience: { include: { services: { include: { quantities: true } } } } }, orderBy: [{ type: "asc" }, { number: "asc" }, { version: "desc" }] }) : Promise.resolve([]),
    canValidateItem ? getDatabase().user.findMany({ where: { status: "ACTIVE" }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true, email: true } }) : Promise.resolve([]),
  ]);
  const sources = tenderVersions.filter(version => version.requirements.some(requirement => requirement.status === "VALIDATED") && version.requirements.every(requirement => requirement.status === "VALIDATED" || requirement.status === "REJECTED")).map(version => ({ id: version.id, label: `${version.tender.code} · versão ${version.version} · ${version.fileName}`, requirements: version.requirements.filter(requirement => requirement.status === "VALIDATED").length }));
  const evidenceOptions = technicalEvidence.map(evidence => ({ id: evidence.id, label: `${evidence.type} ${evidence.number} v${evidence.version}`, status: evidence.status, quantities: evidence.experience.services.flatMap(service => service.quantities.map(quantity => ({ id: quantity.id, label: `${service.discipline} · ${quantity.value.toString()} ${quantity.unit} · ${quantity.source}`, unit: quantity.unit }))) }));
  const responsibleOptions = activeUsers.map(user => ({ id: user.id, label: `${user.displayName} · ${user.email}` }));

  return <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
    <header><Link className="text-sm font-bold text-brand" href="/">← Início</Link><h1 className="mt-6 text-3xl font-bold">Matrizes de atendimento</h1><p className="mt-2 text-muted">Cada item preserva o requisito, as evidências e todas as versões da validação técnica humana.</p></header>
    {authorize(authorization, { permission: "compliance-matrices.create" }).allowed && <MatrixForm sources={sources} />}
    <section className="grid gap-5"><h2 className="text-2xl font-bold">Versões de análise</h2>{matrices.map(matrix => <article className="rounded-2xl border border-border bg-surface p-6" key={matrix.id}>
      <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold text-brand">{matrix.tender.code} · Edital {matrix.tender.number} · versão documental {matrix.tender.version}</p><h3 className="mt-1 text-xl font-bold">{matrix.analysisReference}</h3></div><span className="text-sm font-bold">{matrix.status} · matriz v{matrix.version}</span></div>
      <p className="mt-2 text-sm text-muted">{matrix.tender.subject}</p><p className="mt-1 break-all font-mono text-xs text-muted">Fonte SHA-256: {matrix.sourceFileHash}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">{matrix.status === "IN_ANALYSIS" && canFinalize && <MatrixExportButton matrixId={matrix.id} />}{matrix.exports[0] && canExport && <a className="rounded-lg border border-brand px-4 py-2 text-xs font-bold text-brand" href={`/api/compliance-matrices/exports/${matrix.exports[0].id}`}>Baixar exportação JSON</a>}{matrix.exports[0] && <span className="break-all font-mono text-xs text-muted">Exportação SHA-256: {matrix.exports[0].fileHash}</span>}</div>
      <div className="mt-5 grid gap-3">{matrix.items.map(item => {
        const latestAssessment = item.assessments[0];
        const requiresRevalidation = Boolean(latestAssessment && latestAssessment.evidenceCount !== item.evidenceLinks.length);
        return <div className="rounded-xl border border-border p-4" key={item.id}>
          <div className="flex flex-wrap justify-between gap-2"><strong>{item.requirementType} · {criticalityLabels[item.criticality] ?? item.criticality}</strong><span className="text-xs text-muted">Requisito v{item.requirementVersion} · página {item.sourcePage}</span></div>
          <p className="mt-2 text-sm">{item.requirementText}</p><blockquote className="mt-2 border-l-4 border-blue-200 pl-3 text-xs text-muted">{item.sourceExcerpt}</blockquote>
          <div className="mt-4 grid gap-3">{item.evidenceLinks.map(link => <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4" key={link.id}><div className="flex flex-wrap justify-between gap-2"><strong>{link.evidenceLabel}</strong><span className="text-xs font-bold">{link.evidenceStatus}</span></div><p className="mt-1 text-xs">{link.documentLabel} · localizador: {link.locator}</p><p className="mt-1 break-all font-mono text-xs text-muted">SHA-256: {link.evidenceFileHash}</p><p className="mt-2 text-xs">Justificativa: {link.justification}</p>{link.comparisons.map(comparison => <div className="mt-3 rounded-lg bg-white p-3 text-xs" key={comparison.id}><p><strong>Exigido:</strong> {comparison.requiredValue} {comparison.requiredUnit} · <strong>Comprovado:</strong> {comparison.provenValue} {comparison.provenUnit}</p><p className="mt-1"><strong>Comprovado normalizado:</strong> {comparison.normalizedProvenValue} {comparison.requiredUnit} · <strong>Diferença:</strong> {comparison.difference} {comparison.requiredUnit}</p><p className="mt-1 text-muted">Fonte do quantitativo: {comparison.quantitySource}</p>{comparison.conversionFactor && <p className="mt-1 text-muted">Conversão: fator {comparison.conversionFactor} · {comparison.conversionRule} · fonte {comparison.conversionSource}</p>}</div>)}</div>)}{item.evidenceLinks.length === 0 && <p className="text-xs font-bold text-amber-700">Nenhuma evidência associada.</p>}</div>
          {latestAssessment ? <section className={`mt-4 rounded-xl border p-4 ${requiresRevalidation ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50"}`}><div className="flex flex-wrap justify-between gap-2"><strong>{decisionLabels[latestAssessment.decision] ?? latestAssessment.decision} · validação v{latestAssessment.version}</strong><span className="text-xs">{latestAssessment.validatedBy} · {latestAssessment.validatedAt.toLocaleString("pt-BR")}</span></div><p className="mt-2 text-xs">Justificativa: {latestAssessment.justification}</p><p className="mt-1 text-xs text-muted">Evidências consideradas: {latestAssessment.evidenceCount}</p>{requiresRevalidation && <p className="mt-2 text-xs font-bold text-amber-800">Há nova evidência após esta validação. Registre uma nova versão.</p>}{latestAssessment.gapDescription && <div className="mt-3 grid gap-2 text-xs md:grid-cols-2"><p><strong>Lacuna:</strong> {latestAssessment.gapDescription}</p><p><strong>Risco:</strong> {latestAssessment.riskDescription}</p><p><strong>Impacto:</strong> {latestAssessment.impact}</p><p><strong>Tratamento:</strong> {latestAssessment.treatment}</p><p><strong>Responsável:</strong> {latestAssessment.responsible}</p><p><strong>Prazo:</strong> {latestAssessment.dueAt?.toLocaleString("pt-BR")}</p></div>}<details className="mt-3 text-xs"><summary className="cursor-pointer font-bold">Histórico de validações ({item.assessments.length})</summary><ol className="mt-2 grid gap-1">{item.assessments.map(assessment => <li key={assessment.id}>v{assessment.version} · {decisionLabels[assessment.decision] ?? assessment.decision} · {assessment.validatedBy} · {assessment.validatedAt.toLocaleString("pt-BR")}</li>)}</ol></details></section> : <p className="mt-4 text-xs font-bold text-amber-700">Validação técnica pendente.</p>}
          {canAssociateEvidence && matrix.status === "IN_ANALYSIS" && <MatrixEvidenceForm itemId={item.id} evidence={evidenceOptions} />}
          {canValidateItem && matrix.status === "IN_ANALYSIS" && <ItemAssessmentForm itemId={item.id} responsibles={responsibleOptions} />}
        </div>;
      })}</div>
    </article>)}{matrices.length === 0 && <p className="rounded-2xl border border-border bg-surface p-10 text-center text-muted">Nenhuma matriz criada.</p>}</section>
  </main>;
}
