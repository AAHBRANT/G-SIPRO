import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { AdminUserManager } from "./admin-user-manager";
import { OperationalBaseManager } from "./operational-base-manager";

function auditWindowStart() { return new Date(Date.now() - 24 * 60 * 60 * 1000); }

export default async function AdminPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorization?.isMaster) notFound();
  const database = getDatabase();
  const since = auditWindowStart();
  const now = new Date();
  const [users, permissions, departments, failures, pendingSupport, accessRequests, operationalBases] = await Promise.all([
    database.user.findMany({ where: { archivedAt: null }, include: { department: true, profileMemberships: { where: { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }], profile: { active: true } }, include: { profile: { include: { permissions: true } } }, orderBy: { grantedAt: "desc" } } }, orderBy: { displayName: "asc" } }),
    database.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] }),
    database.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    database.auditEvent.count({ where: { occurredAt: { gte: since }, outcome: "FAILURE" } }),
    database.supportTicket.count({ where: { status: { in: ["WAITING_APPROVAL", "OWNER_ACTION_REQUIRED", "ESCALATED"] } } }),
    database.userAccessRequest.findMany({
      where: authorization.isOwner ? undefined : { requestedById: authorization.actorId },
      include: { requestedBy: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    database.operationalBase.findMany({ where: { active: true }, orderBy: [{ name: "asc" }, { code: "asc" }] }),
  ]);
  const activeUsers = users.filter((user) => user.status === "ACTIVE").length;
  const masterUsers = users.filter((user) => user.isMaster && user.status === "ACTIVE").length;
  const ownerUsers = users.filter((user) => user.isOwner && user.status === "ACTIVE").length;

  return <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader action={<div className="flex gap-2"><Link className="inline-flex h-11 items-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-800" href="/admin/support">Suporte{pendingSupport ? ` · ${pendingSupport}` : ""}</Link><Link className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700" href="/admin/support#intelligence-policies">Política analítica</Link><Link className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700" href="/ai-governance">Governança de IA</Link><Link className="inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-bold text-white" href="/indicators#configurar-indicador">Indicadores</Link></div>} eyebrow="Sistema" icon="dashboard" subtitle="Usuários, perfis de acesso, permissões e eventos de auditoria do G-SIPRO." title="Administrador"/>
    <section aria-label="Indicadores administrativos" className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-6"><MetricCard description="Identidades corporativas ativas" icon="target" title="Usuários ativos" tone="green" value={activeUsers}/><MetricCard description="Total de identidades provisionadas" icon="file" title="Usuários cadastrados" tone="blue" value={users.length}/><MetricCard description="Intervenção excepcional após três tentativas" icon="target" title="Proprietários" tone="amber" value={ownerUsers}/><MetricCard description="Acesso integral à estrutura" icon="pipeline" title="Usuários mestres" tone="violet" value={masterUsers}/><MetricCard description="Permissões disponíveis no sistema" icon="chart" title="Permissões cadastradas" tone="blue" value={permissions.length}/><MetricCard description="Eventos com falha nas últimas 24 horas" icon="clock" title="Alertas de auditoria" tone={failures ? "red" : "slate"} value={failures}/></section>

    <div className="mt-6"><AdminUserManager accessRequests={accessRequests.map(request => { const payload = request.payload as { displayName?: string; email?: string; isMaster?: boolean; isOwner?: boolean }; return { id: request.id, action: request.action, status: request.status, requestedBy: request.requestedBy.displayName, displayName: payload.displayName ?? "Usuário não informado", email: payload.email ?? "E-mail não informado", requestedRole: payload.isOwner ? "Proprietário" : payload.isMaster ? "Usuário mestre" : "Usuário comum", createdAt: request.createdAt.toISOString(), decisionNote: request.decisionNote }; })} canApprovePrivilegedAccess={Boolean(authorization.isOwner)} canManageOwners={Boolean(authorization.isOwner)} currentActorId={authorization.actorId} departments={departments.map((department) => ({ id: department.id, name: department.name }))} permissions={permissions.map((permission) => ({ id: permission.id, code: permission.code, module: permission.module, action: permission.action, description: permission.description }))} users={users.map((user) => ({ id: user.id, displayName: user.displayName, email: user.email, status: user.status, teamsProvisioningStatus: user.teamsProvisioningStatus, teamsProvisioningAttempts: user.teamsProvisioningAttempts, teamsProvisioningErrorCode: user.teamsProvisioningErrorCode, isMaster: user.isMaster, isOwner: user.isOwner, departmentId: user.departmentId, departmentName: user.department?.name ?? null, profileNames: user.profileMemberships.map((membership) => membership.profile.name), permissionIds: [...new Set(user.profileMemberships.flatMap((membership) => membership.profile.permissions.map((item) => item.permissionId)))] }))}/></div>
    <OperationalBaseManager bases={operationalBases.map((base) => ({ id: base.id, code: base.code, name: base.name, locality: base.locality, latitude: Number(base.latitude), longitude: Number(base.longitude), source: base.source, version: base.version }))} canConfigure={authorize(authorization, { permission: "analytics.configure" }).allowed}/>
  </main>;
}
