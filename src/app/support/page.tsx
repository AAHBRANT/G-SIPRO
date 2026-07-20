import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { SupportCenter, type SupportTicketView } from "./support-center";

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorization) redirect("/api/auth/signin");
  const tickets = await getDatabase().supportTicket.findMany({
    where: { reporterId: authorization.actorId },
    include: { attachments: { select: { id: true, fileName: true, mimeType: true } }, updates: { include: { createdBy: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  const { from } = await searchParams;
  const safeFrom = typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from.slice(0, 500) : "";
  const views: SupportTicketView[] = tickets.map(ticket => ({ id: ticket.id, number: ticket.number, type: ticket.type, priority: ticket.priority, status: ticket.status, title: ticket.title, description: ticket.description, pagePath: ticket.pagePath, errorMessage: ticket.errorMessage, stepsToReproduce: ticket.stepsToReproduce, aiDiagnosis: ticket.aiDiagnosis as SupportTicketView["aiDiagnosis"], aiProviderModel: ticket.aiProviderModel, approvalRequired: ticket.approvalRequired, approvalReason: ticket.approvalReason, resolution: ticket.resolution, createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(), executorId: ticket.executorId, executionHeartbeatAt: ticket.executionHeartbeatAt?.toISOString() ?? null, executionAttempts: ticket.executionAttempts, attachments: ticket.attachments, updates: ticket.updates.map(update => ({ id: update.id, toStatus: update.toStatus, note: update.note, createdAt: update.createdAt.toISOString(), createdBy: update.createdBy?.displayName ?? update.actorLabel })) }));
  return <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><PageHeader eyebrow="Atendimento" icon="file" subtitle="Relate problemas, acompanhe diagnósticos e receba a solução dentro do próprio sistema." title="Suporte G-SIPRO"/><SupportCenter initialPage={safeFrom} tickets={views}/></main>;
}
