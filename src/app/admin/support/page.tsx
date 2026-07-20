import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import type { SupportTicketView } from "@/app/support/support-center";
import { SupportAdmin } from "./support-admin";

export default async function SupportAdminPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorization?.isMaster) notFound();
  const tickets = await getDatabase().supportTicket.findMany({ include: { reporter: { select: { displayName: true, email: true } }, attachments: { select: { id: true, fileName: true, mimeType: true } }, updates: { include: { createdBy: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } } }, orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 200 });
  const views = tickets.map(ticket => ({ id: ticket.id, number: ticket.number, type: ticket.type, priority: ticket.priority, status: ticket.status, title: ticket.title, description: ticket.description, pagePath: ticket.pagePath, errorMessage: ticket.errorMessage, stepsToReproduce: ticket.stepsToReproduce, aiDiagnosis: ticket.aiDiagnosis as SupportTicketView["aiDiagnosis"], aiProviderModel: ticket.aiProviderModel, approvalRequired: ticket.approvalRequired, approvalReason: ticket.approvalReason, resolution: ticket.resolution, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(), executorId: ticket.executorId, executionHeartbeatAt: ticket.executionHeartbeatAt?.toISOString() ?? null, executionAttempts: ticket.executionAttempts, attachments: ticket.attachments, updates: ticket.updates.map(update => ({ id: update.id, toStatus: update.toStatus, note: update.note, createdAt: update.createdAt.toISOString(), createdBy: update.createdBy?.displayName ?? update.actorLabel })), reporter: ticket.reporter.displayName, reporterEmail: ticket.reporter.email }));
  const action = <div className="flex flex-wrap gap-2">
    <a className="rounded-lg bg-brand px-4 py-3 text-sm font-bold text-white" href="/api/support/execution-queue" rel="noreferrer" target="_blank">Fila técnica</a>
    <Link className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold" href="/admin">← Administrador</Link>
  </div>;
  return <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><PageHeader action={action} eyebrow="Sistema" icon="file" subtitle="Diagnósticos, autorizações e acompanhamento das correções solicitadas pela equipe." title="Suporte e melhorias"/><section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard description="Todas as solicitações" icon="file" title="Chamados" tone="blue" value={tickets.length}/><MetricCard description="Dependem da sua decisão" icon="clock" title="Aguardando aprovação" tone="amber" value={tickets.filter(ticket => ticket.status === "WAITING_APPROVAL").length}/><MetricCard description="Correções em execução" icon="pipeline" title="Em atendimento" tone="violet" value={tickets.filter(ticket => ticket.status === "IN_PROGRESS").length}/><MetricCard description="Atendimentos concluídos" icon="target" title="Resolvidos" tone="green" value={tickets.filter(ticket => ticket.status === "RESOLVED").length}/></section><SupportAdmin tickets={views}/></main>;
}
