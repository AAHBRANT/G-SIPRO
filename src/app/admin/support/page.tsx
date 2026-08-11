import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { intelligenceThresholdsSchema, intelligenceWeightsSchema } from "@/modules/opportunity-intelligence/domain/intelligence-policy";
import type { SupportExternalBlocker, SupportTicketView } from "@/app/support/support-center";
import { IntelligencePolicyAdmin } from "./intelligence-policy-admin";
import { SupportAdmin } from "./support-admin";

export default async function SupportAdminPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorization || (!authorization.isMaster && !authorization.isOwner)) notFound();
  const database = getDatabase();
  const [tickets, policies, users] = await Promise.all([
    database.supportTicket.findMany({ include: { reporter: { select: { displayName: true, email: true } }, attachments: { select: { id: true, fileName: true, mimeType: true } }, updates: { include: { createdBy: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } } }, orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 200 }),
    database.intelligencePolicy.findMany({ include: { approval: true }, orderBy: [{ createdAt: "desc" }], take: 50 }),
    database.user.findMany({ select: { id: true, displayName: true } }),
  ]);
  tickets.sort((left, right) => Number(right.status === "OWNER_ACTION_REQUIRED") - Number(left.status === "OWNER_ACTION_REQUIRED") || Number(right.status === "WAITING_APPROVAL") - Number(left.status === "WAITING_APPROVAL") || Number(right.status === "ESCALATED") - Number(left.status === "ESCALATED") || Number(right.status === "IN_PROGRESS") - Number(left.status === "IN_PROGRESS"));
  const views = tickets.map(ticket => ({ id: ticket.id, number: ticket.number, type: ticket.type, priority: ticket.priority, status: ticket.status, title: ticket.title, description: ticket.description, pagePath: ticket.pagePath, errorMessage: ticket.errorMessage, stepsToReproduce: ticket.stepsToReproduce, aiDiagnosis: ticket.aiDiagnosis as SupportTicketView["aiDiagnosis"], aiProviderModel: ticket.aiProviderModel, approvalRequired: ticket.approvalRequired, approvalReason: ticket.approvalReason, resolution: ticket.resolution, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(), resolvedAt: ticket.resolvedAt?.toISOString() ?? null, executorId: ticket.executorId, executionClaimedAt: ticket.executionClaimedAt?.toISOString() ?? null, executionHeartbeatAt: ticket.executionHeartbeatAt?.toISOString() ?? null, executionAttempts: ticket.executionAttempts, resolutionAttempts: ticket.resolutionAttempts, validationQuestions: ticket.validationQuestions as SupportTicketView["validationQuestions"], validationRequestedAt: ticket.validationRequestedAt?.toISOString() ?? null, externalBlocker: ticket.externalBlocker as SupportExternalBlocker | null, ownerActionRequiredAt: ticket.ownerActionRequiredAt?.toISOString() ?? null, escalatedAt: ticket.escalatedAt?.toISOString() ?? null, attachments: ticket.attachments, updates: ticket.updates.map(update => ({ id: update.id, toStatus: update.toStatus, note: update.note, createdAt: update.createdAt.toISOString(), createdBy: update.createdBy?.displayName ?? update.actorLabel, createdById: update.createdById })), reporter: ticket.reporter.displayName, reporterEmail: ticket.reporter.email }));
  const userNames = new Map(users.map(user => [user.id, user.displayName]));
  const policyViews = policies.map(policy => ({
    id: policy.id,
    code: policy.code,
    name: policy.name,
    version: policy.version,
    purpose: policy.purpose,
    weights: intelligenceWeightsSchema.parse(policy.weights),
    thresholds: intelligenceThresholdsSchema.parse(policy.thresholds),
    coverageMinimum: Number(policy.coverageMinimum),
    effectiveFrom: policy.effectiveFrom.toISOString(),
    changeReason: policy.changeReason,
    createdBy: userNames.get(policy.createdBy) ?? "Usuário não identificado",
    createdById: policy.createdBy,
    createdAt: policy.createdAt.toISOString(),
    approvedAt: policy.approval?.approvedAt.toISOString() ?? null,
    approvedBy: policy.approval ? userNames.get(policy.approval.approvedBy) ?? "Proprietário" : null,
    approvalNote: policy.approval?.note ?? null,
  }));
  const pendingPolicies = policies.filter(policy => !policy.approval).length;
  const action = <div className="flex flex-wrap gap-2">
    <Link className="rounded-lg bg-brand px-4 py-3 text-sm font-bold text-white" href="#intelligence-policies">Política analítica{pendingPolicies ? ` · ${pendingPolicies}` : ""}</Link>
    <a className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold" href="/api/support/execution-queue" rel="noreferrer" target="_blank">Fila técnica</a>
    <Link className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold" href="/admin">← Administrador</Link>
  </div>;
  return <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7"><PageHeader action={action} eyebrow="Sistema" icon="file" subtitle="Acompanhe solicitações, aprove mudanças e consulte a evolução das tentativas automáticas." title="Aprovações e chamados" variant="executive"/><section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7"><MetricCard description="Todas as solicitações" icon="file" title="Chamados" value={tickets.length} variant="executive"/><MetricCard description="Políticas analíticas sem decisão" icon="chart" title="Políticas pendentes" tone="amber" value={pendingPolicies} variant="executive"/><MetricCard description="Melhorias e novas ferramentas" icon="clock" title="Aguardando aprovação" tone="amber" value={tickets.filter(ticket => ticket.status === "WAITING_APPROVAL").length} variant="executive"/><MetricCard description="Microsoft, Azure ou segurança" icon="target" title="Ação do proprietário" tone="amber" value={tickets.filter(ticket => ticket.status === "OWNER_ACTION_REQUIRED").length} variant="executive"/><MetricCard description="Aguardando início automático" icon="clock" title="Na fila da GUULY" value={tickets.filter(ticket => ["OPEN", "TRIAGED", "APPROVED"].includes(ticket.status)).length} variant="executive"/><MetricCard description="Alterações em execução" icon="pipeline" title="Em atendimento" value={tickets.filter(ticket => ticket.status === "IN_PROGRESS").length} variant="executive"/><MetricCard description="Intervenção após três tentativas" icon="target" title="Escalados" value={tickets.filter(ticket => ticket.status === "ESCALATED").length} variant="executive"/></section><IntelligencePolicyAdmin canApprove={Boolean(authorization.isOwner)} canPropose={authorize(authorization, { permission: "analytics.configure" }).allowed} currentActorId={authorization.actorId} effectiveFrom={new Date().toISOString().slice(0, 10)} policies={policyViews}/><div id="approvals"><SupportAdmin canApprove={Boolean(authorization.isOwner)} currentActorId={authorization.actorId} tickets={views}/></div></main>;
}
