import Link from "next/link";
import { notFound } from "next/navigation";
import { GsIcon } from "@/components/ui/gs-icon";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { AdminUserManager } from "./admin-user-manager";

function auditWindowStart() { return new Date(Date.now() - 24 * 60 * 60 * 1000); }

export default async function AdminPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorization?.isMaster) notFound();
  const database = getDatabase();
  const since = auditWindowStart();
  const now = new Date();
  const [users, profiles, permissions, departments, recentEvents, failures, pendingSupport] = await Promise.all([
    database.user.findMany({ include: { department: true, profileMemberships: { where: { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }], profile: { active: true } }, include: { profile: { include: { permissions: true } } }, orderBy: { grantedAt: "desc" } } }, orderBy: { displayName: "asc" } }),
    database.profile.findMany({ include: { _count: { select: { memberships: true, permissions: true } } }, orderBy: { name: "asc" } }),
    database.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] }),
    database.department.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    database.auditEvent.findMany({ orderBy: { occurredAt: "desc" }, take: 30 }),
    database.auditEvent.count({ where: { occurredAt: { gte: since }, outcome: "FAILURE" } }),
    database.supportTicket.count({ where: { status: { in: ["WAITING_APPROVAL", "ESCALATED"] } } }),
  ]);
  const activeUsers = users.filter((user) => user.status === "ACTIVE").length;
  const activeProfiles = profiles.filter((profile) => profile.active).length;
  const masterUsers = users.filter((user) => user.isMaster && user.status === "ACTIVE").length;
  const ownerUsers = users.filter((user) => user.isOwner && user.status === "ACTIVE").length;

  return <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader action={<div className="flex gap-2"><Link className="inline-flex h-11 items-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-800" href="/admin/support">Suporte{pendingSupport ? ` · ${pendingSupport}` : ""}</Link><Link className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700" href="/ai-governance">Governança de IA</Link><Link className="inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-bold text-white" href="/indicators#configurar-indicador">Indicadores</Link></div>} eyebrow="Sistema" icon="dashboard" subtitle="Usuários, perfis de acesso, permissões e eventos de auditoria do G-SIPRO." title="Administrador"/>
    <section aria-label="Indicadores administrativos" className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-6"><MetricCard description="Identidades corporativas ativas" icon="target" title="Usuários ativos" tone="green" value={activeUsers}/><MetricCard description="Total de identidades provisionadas" icon="file" title="Usuários cadastrados" tone="blue" value={users.length}/><MetricCard description="Autoridade para aprovar mudanças" icon="target" title="Proprietários" tone="amber" value={ownerUsers}/><MetricCard description="Acesso integral à estrutura" icon="pipeline" title="Usuários mestres" tone="violet" value={masterUsers}/><MetricCard description="Permissões disponíveis no sistema" icon="chart" title="Permissões cadastradas" tone="blue" value={permissions.length}/><MetricCard description="Eventos com falha nas últimas 24 horas" icon="clock" title="Alertas de auditoria" tone={failures ? "red" : "slate"} value={failures}/></section>

    <div className="mt-6"><AdminUserManager canManageOwners={Boolean(authorization.isOwner)} departments={departments.map((department) => ({ id: department.id, name: department.name }))} permissions={permissions.map((permission) => ({ id: permission.id, code: permission.code, module: permission.module, action: permission.action, description: permission.description }))} users={users.map((user) => ({ id: user.id, displayName: user.displayName, email: user.email, status: user.status, isMaster: user.isMaster, isOwner: user.isOwner, departmentId: user.departmentId, departmentName: user.department?.name ?? null, profileNames: user.profileMemberships.map((membership) => membership.profile.name), permissionIds: [...new Set(user.profileMemberships.flatMap((membership) => membership.profile.permissions.map((item) => item.permissionId)))] }))}/></div>

    <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]"><Panel subtitle={`${activeProfiles} perfis ativos, incluindo os acessos individuais`} title="Perfis de acesso"><div className="divide-y divide-slate-100">{profiles.slice(0, 10).map((profile) => <article className="flex items-center gap-4 px-6 py-4" key={profile.id}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-brand"><GsIcon className="h-4 w-4" name="target"/></span><div className="min-w-0 flex-1"><p className="font-bold text-slate-900">{profile.name}</p><p className="mt-1 text-xs text-slate-500">{profile._count.memberships} usuário(s) · {profile._count.permissions} permissão(ões)</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${profile.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{profile.active ? "Ativo" : "Inativo"}</span></article>)}</div></Panel><Panel subtitle="Regras aplicadas pelo sistema" title="Como funciona"><div className="space-y-4 p-6 text-sm leading-6 text-slate-600"><p><strong className="text-slate-900">Proprietário:</strong> possui acesso integral e autoridade exclusiva para aprovar melhorias e novas ferramentas.</p><p><strong className="text-slate-900">Usuário mestre:</strong> visualiza todos os dashboards, módulos e ações administrativas, mas não aprova mudanças.</p><p><strong className="text-slate-900">Usuário comum:</strong> vê somente os módulos que possuem permissão de consulta e executa apenas as ações marcadas.</p><p><strong className="text-slate-900">Login corporativo:</strong> o acesso é vinculado automaticamente ao e-mail cadastrado no primeiro login Microsoft.</p></div></Panel></section>

    <Panel className="mt-6" subtitle="Últimos eventos registrados pelo sistema" title="Auditoria recente"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Data e hora</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Entidade</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Resultado</th></tr></thead><tbody className="divide-y divide-slate-100">{recentEvents.map((event) => <tr className="hover:bg-blue-50/30" key={event.id}><td className="whitespace-nowrap px-5 py-4 text-slate-600">{event.occurredAt.toLocaleString("pt-BR")}</td><td className="px-4 py-4 font-semibold text-slate-800">{event.action}</td><td className="px-4 py-4 text-slate-600">{event.entityType}{event.entityId ? ` · ${event.entityId}` : ""}</td><td className="px-4 py-4 text-slate-600">{event.origin}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${event.outcome === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{event.outcome === "SUCCESS" ? "Sucesso" : "Falha"}</span></td></tr>)}</tbody></table></div></Panel>
  </main>;
}
