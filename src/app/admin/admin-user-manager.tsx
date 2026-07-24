"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { GsIcon } from "@/components/ui/gs-icon";

type PermissionOption = { id: string; code: string; module: string; action: string; description: string | null };
type DepartmentOption = { id: string; name: string };
type TeamsProvisioningStatus = "NOT_CONFIGURED" | "PENDING" | "INSTALLED" | "FAILED";
type TeamsProvisioningResponse = { status: TeamsProvisioningStatus; errorCode: string | null; message: string };
export type ManagedUser = { id: string; displayName: string; email: string; status: "ACTIVE" | "INACTIVE" | "BLOCKED"; teamsProvisioningStatus: TeamsProvisioningStatus; teamsProvisioningAttempts: number; teamsProvisioningErrorCode: string | null; isMaster: boolean; isOwner: boolean; departmentId: string | null; departmentName: string | null; profileNames: string[]; permissionIds: string[] };
type AccessRequestView = { id: string; action: "CREATE" | "UPDATE"; status: "PENDING" | "APPROVED" | "REJECTED"; requestedBy: string; displayName: string; email: string; requestedRole: string; createdAt: string; decisionNote: string | null };
type Draft = { id?: string; displayName: string; email: string; departmentId: string; status: ManagedUser["status"]; isMaster: boolean; isOwner: boolean; permissionIds: string[] };

const emptyDraft: Draft = { displayName: "", email: "", departmentId: "", status: "ACTIVE", isMaster: false, isOwner: false, permissionIds: [] };
const moduleNames: Record<string, string> = { opportunities: "Oportunidades", proposals: "Propostas", tenders: "Editais e documentos da proposta", requirements: "Requisitos da proposta", deadlines: "Prazos", "compliance-matrices": "Matriz de requisitos", documents: "Documentos", competitions: "Concorrências", "technical-archive": "Acervo técnico", indicators: "Inteligência e KPIs", ai: "Inteligência aplicada" };
const statusNames = { ACTIVE: "Ativo", INACTIVE: "Inativo", BLOCKED: "Bloqueado" } as const;
const isReadAction = (action: string) => /read|search|list|view|export/i.test(action);

export function AdminUserManager({ users, departments, permissions, accessRequests, canManageOwners, canApprovePrivilegedAccess, initialOpen = false }: { users: ManagedUser[]; departments: DepartmentOption[]; permissions: PermissionOption[]; accessRequests: AccessRequestView[]; canManageOwners: boolean; canApprovePrivilegedAccess: boolean; initialOpen?: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(initialOpen ? emptyDraft : null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [decidingRequest, setDecidingRequest] = useState<string | null>(null);
  const [provisioningUser, setProvisioningUser] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const grouped = useMemo(() => Array.from(new Set(permissions.map((permission) => permission.module))).sort((a, b) => (moduleNames[a] ?? a).localeCompare(moduleNames[b] ?? b)).map((module) => ({ module, items: permissions.filter((permission) => permission.module === module) })), [permissions]);
  const filteredUsers = useMemo(() => users.filter((user) => {
    const category = user.isOwner ? "OWNER" : user.isMaster ? "MASTER" : "COMMON";
    const haystack = `${user.displayName} ${user.email} ${user.departmentName ?? ""} ${user.profileNames.join(" ")}`.toLocaleLowerCase("pt-BR");
    return (!query || haystack.includes(query.toLocaleLowerCase("pt-BR"))) && (!statusFilter || user.status === statusFilter) && (!categoryFilter || category === categoryFilter);
  }), [users, query, statusFilter, categoryFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstRecord = filteredUsers.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastRecord = Math.min(safePage * pageSize, filteredUsers.length);
  const controlClass = "h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

  function close() { setDraft(null); setMessage(null); if (initialOpen) router.replace("/admin"); }
  function edit(user: ManagedUser) { setMessage(null); setDraft({ id: user.id, displayName: user.displayName, email: user.email, departmentId: user.departmentId ?? "", status: user.status, isMaster: user.isMaster, isOwner: user.isOwner, permissionIds: user.permissionIds }); }
  function togglePermission(permissionId: string) { setDraft((current) => current ? { ...current, permissionIds: current.permissionIds.includes(permissionId) ? current.permissionIds.filter((id) => id !== permissionId) : [...current.permissionIds, permissionId] } : current); }
  function toggleModule(ids: string[]) { setDraft((current) => { if (!current) return current; const allSelected = ids.every((id) => current.permissionIds.includes(id)); return { ...current, permissionIds: allSelected ? current.permissionIds.filter((id) => !ids.includes(id)) : [...new Set([...current.permissionIds, ...ids])] }; }); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draft) return; setSaving(true); setMessage(null);
    try {
      const response = await fetch(draft.id ? `/api/admin/users/${draft.id}` : "/api/admin/users", { method: draft.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, departmentId: draft.departmentId || null }) });
      const payload = await response.json() as { data?: { pendingApproval?: boolean; teamsProvisioning?: TeamsProvisioningResponse | null }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Não foi possível salvar o usuário.");
      if (payload.data?.pendingApproval) {
        setDraft(null);
        setNotice("Solicitação enviada ao proprietário. O usuário mestre será criado somente após a aprovação.");
        router.refresh();
      } else {
        close();
        setNotice(payload.data?.teamsProvisioning?.message ?? "Usuário e acessos salvos.");
        router.refresh();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar o usuário."); }
    finally { setSaving(false); }
  }

  async function decideAccessRequest(requestId: string, decision: "APPROVED" | "REJECTED") {
    setDecidingRequest(requestId);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/user-access-requests/${requestId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: decision === "APPROVED" ? "Cadastro privilegiado aprovado pelo proprietário." : "Cadastro privilegiado rejeitado pelo proprietário." }),
      });
      const payload = await response.json() as { data?: { teamsProvisioning?: TeamsProvisioningResponse | null }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Não foi possível registrar a decisão.");
      setNotice(decision === "APPROVED" ? payload.data?.teamsProvisioning?.message ?? "Solicitação aprovada e cadastro concluído." : "Solicitação rejeitada.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
    } finally {
      setDecidingRequest(null);
    }
  }

  async function retryTeamsProvisioning(userId: string) {
    setProvisioningUser(userId);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/teams-provisioning`, { method: "POST" });
      const payload = await response.json() as { data?: { teamsProvisioning?: TeamsProvisioningResponse }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Não foi possível instalar o aplicativo no Teams.");
      setNotice(payload.data?.teamsProvisioning?.message ?? "Solicitação enviada ao Microsoft Teams.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível instalar o aplicativo no Teams.");
    } finally {
      setProvisioningUser(null);
    }
  }

  return <>
    {notice && <p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{notice}</p>}
    {accessRequests.length > 0 && <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-xs font-black uppercase tracking-wide text-slate-800">Solicitações de acesso privilegiado</h2><p className="mt-1 text-[10px] text-slate-500">Cadastros de usuários mestres solicitados por um mestre são decididos pelo proprietário.</p></div>
      <div className="divide-y divide-slate-100">{accessRequests.map(request => <article className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center" key={request.id}>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{request.displayName}</p><span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] font-bold text-violet-700">{request.requestedRole}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${request.status === "PENDING" ? "bg-amber-50 text-amber-800" : request.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{request.status === "PENDING" ? "Aguardando proprietário" : request.status === "APPROVED" ? "Aprovado" : "Rejeitado"}</span></div><p className="mt-1 text-[10px] text-slate-500">{request.email} · solicitado por {request.requestedBy} em {new Date(request.createdAt).toLocaleString("pt-BR")}</p>{request.decisionNote && <p className="mt-1 text-[10px] text-slate-600">{request.decisionNote}</p>}</div>
        {request.status === "PENDING" && canApprovePrivilegedAccess && <div className="flex gap-2"><button className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50" disabled={decidingRequest === request.id} onClick={() => decideAccessRequest(request.id, "APPROVED")} type="button">Aprovar cadastro</button><button className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-bold text-rose-700 disabled:opacity-50" disabled={decidingRequest === request.id} onClick={() => decideAccessRequest(request.id, "REJECTED")} type="button">Rejeitar</button></div>}
      </article>)}</div>
    </section>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center"><h2 className="mr-auto flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-800"><GsIcon className="h-4 w-4 text-brand" name="table"/> Usuários e acessos</h2><div className="flex flex-wrap gap-2"><label className="relative"><GsIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" name="search"/><input aria-label="Buscar usuário" className="h-9 w-60 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar usuário..." value={query}/></label><button className={`${controlClass} inline-flex items-center gap-2`} onClick={() => setShowFilters((value) => !value)} type="button"><GsIcon className="h-4 w-4" name="filter"/> Filtros</button><button className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-xs font-bold text-white shadow-sm" onClick={() => { setMessage(null); setDraft(emptyDraft); }} type="button"><span className="text-base font-normal">＋</span> Adicionar usuário</button></div></div>
      {showFilters && <div className="grid gap-3 border-b border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2 lg:grid-cols-4"><select aria-label="Filtrar por situação" className={controlClass} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} value={statusFilter}><option value="">Todas as situações</option><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option><option value="BLOCKED">Bloqueado</option></select><select aria-label="Filtrar por categoria" className={controlClass} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }} value={categoryFilter}><option value="">Todas as categorias</option><option value="COMMON">Usuário comum</option><option value="MASTER">Usuário mestre</option><option value="OWNER">Proprietário</option></select><button className={controlClass} onClick={() => { setStatusFilter(""); setCategoryFilter(""); setPage(1); }} type="button">Limpar filtros</button></div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[1080px] table-fixed text-left text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Setor / departamento</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Perfil de acesso</th><th className="px-4 py-3">Situação</th><th className="px-3 py-3 text-center">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleUsers.map((user) => <tr className="h-14 hover:bg-blue-50/30" key={user.id}><td className="px-4 py-3"><p className="truncate font-bold text-slate-900">{user.displayName}</p><p className="mt-1 truncate text-[10px] text-slate-500">{user.email}</p></td><td className="px-4 py-3 text-slate-600">{user.departmentName ?? "Não informado"}</td><td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${user.isOwner ? "bg-amber-50 text-amber-800" : user.isMaster ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{user.isOwner ? "Proprietário" : user.isMaster ? "Usuário mestre" : "Usuário comum"}</span></td><td className="max-w-[280px] px-4 py-3 text-[10px] text-slate-600"><p className="truncate">{user.isOwner ? "Acesso integral e aprovação de mudanças" : user.isMaster ? "Toda a estrutura e ações administrativas" : user.profileNames.join(" · ") || "Sem acesso atribuído"}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : user.status === "BLOCKED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{statusNames[user.status]}</span><p className={`mt-1 text-[9px] font-semibold ${user.teamsProvisioningStatus === "INSTALLED" ? "text-emerald-700" : user.teamsProvisioningStatus === "PENDING" ? "text-blue-700" : "text-amber-700"}`}>Teams: {user.teamsProvisioningStatus === "INSTALLED" ? "instalado" : user.teamsProvisioningStatus === "PENDING" ? "instalando" : user.teamsProvisioningStatus === "FAILED" ? "tentativa pendente" : "não configurado"}</p></td><td className="px-3 py-3 text-center"><div className="flex items-center justify-center gap-2"><button className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 hover:border-blue-300 hover:text-brand" onClick={() => edit(user)} type="button">Configurar acesso</button>{user.status === "ACTIVE" && user.teamsProvisioningStatus !== "INSTALLED" && <button className="rounded-lg border border-blue-200 px-3 py-2 text-[10px] font-bold text-blue-700 disabled:opacity-50" disabled={provisioningUser === user.id} onClick={() => retryTeamsProvisioning(user.id)} title={user.teamsProvisioningErrorCode ?? undefined} type="button">{provisioningUser === user.id ? "Instalando..." : "Instalar no Teams"}</button>}</div></td></tr>)}{visibleUsers.length === 0 && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={6}>Nenhum usuário encontrado.</td></tr>}</tbody></table></div>
      <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center"><span>Mostrando {firstRecord} a {lastRecord} de {filteredUsers.length} usuários</span><div className="ml-auto flex items-center gap-1.5"><select aria-label="Quantidade de linhas" className="h-8 rounded-lg border border-slate-200 bg-white px-2 font-semibold" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} value={pageSize}>{[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select><button className="h-8 rounded-lg border border-slate-200 px-3 font-semibold disabled:opacity-40" disabled={safePage <= 1} onClick={() => setPage((value) => value - 1)} type="button">Anterior</button><span className="grid h-8 min-w-8 place-items-center rounded-lg border border-brand font-bold text-brand">{safePage}</span><span className="px-1">de {totalPages}</span><button className="h-8 rounded-lg border border-slate-200 px-3 font-semibold disabled:opacity-40" disabled={safePage >= totalPages} onClick={() => setPage((value) => value + 1)} type="button">Próximo</button></div></footer>
    </section>

    {draft && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6"><button aria-label="Fechar" className="absolute inset-0" onClick={close}/><div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-wider text-brand">Administração de acessos</p><h2 className="mt-1 text-xl font-black text-slate-950">{draft.id ? "Configurar usuário" : "Adicionar usuário"}</h2><p className="mt-1 text-sm text-slate-500">O usuário mestre acessa tudo. Para usuários comuns, marque somente o necessário.</p></div><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900" onClick={close} type="button">✕</button></div>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}><div className="overflow-y-auto p-6"><div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-bold text-slate-700">Nome completo<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-brand" onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} required value={draft.displayName}/></label><label className="text-xs font-bold text-slate-700">E-mail corporativo<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-brand" onChange={(event) => setDraft({ ...draft, email: event.target.value })} required type="email" value={draft.email}/></label><label className="text-xs font-bold text-slate-700">Setor / departamento<select className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-brand" onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })} value={draft.departmentId}><option value="">Não informado</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="text-xs font-bold text-slate-700">Situação<select className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-brand" onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft["status"] })} value={draft.status}><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option><option value="BLOCKED">Bloqueado</option></select></label></div>
        <label className="mt-5 grid gap-2 rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs font-bold text-violet-950">Categoria de acesso<select className="h-11 rounded-lg border border-violet-200 bg-white px-3 text-sm font-semibold" onChange={(event) => { const level = event.target.value; setDraft({ ...draft, isMaster: level !== "COMMON", isOwner: level === "OWNER", status: level === "OWNER" ? "ACTIVE" : draft.status }); }} value={draft.isOwner ? "OWNER" : draft.isMaster ? "MASTER" : "COMMON"}><option value="COMMON">Usuário comum</option><option value="MASTER">Usuário mestre</option><option disabled={!canManageOwners} value="OWNER">Proprietário — pode aprovar mudanças</option></select><span className="font-normal leading-5 text-violet-700">{canManageOwners ? "O proprietário cadastra usuários mestres e outros proprietários diretamente." : "Usuários comuns são cadastrados imediatamente. Solicitações de usuário mestre serão enviadas ao proprietário para aprovação."}</span></label>
        {!draft.isMaster && <section className="mt-6"><div className="flex items-end justify-between gap-3"><div><h3 className="text-sm font-black uppercase tracking-wide text-slate-900">O que este usuário pode ver e fazer</h3><p className="mt-1 text-xs text-slate-500">“Visualizar” controla a presença do módulo no menu; as demais opções controlam as ações.</p></div><span className="text-xs font-bold text-brand">{draft.permissionIds.length} permissões</span></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{grouped.map((group) => { const ids = group.items.map((item) => item.id); const all = ids.every((id) => draft.permissionIds.includes(id)); return <article className="rounded-xl border border-slate-200" key={group.module}><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3"><div><h4 className="text-sm font-black text-slate-900">{moduleNames[group.module] ?? group.module}</h4><p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{group.items.length} ações disponíveis</p></div><button className="text-xs font-bold text-brand" onClick={() => toggleModule(ids)} type="button">{all ? "Desmarcar" : "Permitir tudo"}</button></div><div className="divide-y divide-slate-100">{group.items.map((permission) => <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-blue-50/40" key={permission.id}><input checked={draft.permissionIds.includes(permission.id)} className="mt-0.5 h-4 w-4 accent-blue-600" onChange={() => togglePermission(permission.id)} type="checkbox"/><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="text-xs text-slate-800">{permission.description ?? permission.action}</strong><span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${isReadAction(permission.action) ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{isReadAction(permission.action) ? "Visualizar" : "Executar"}</span></span><span className="mt-1 block font-mono text-[10px] text-slate-400">{permission.code}</span></span></label>)}</div></article>; })}</div></section>}
        {message && <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</p>}
      </div><div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700" onClick={close} type="button">Cancelar</button><button className="h-10 rounded-lg bg-brand px-5 text-sm font-bold text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar usuário e acessos"}</button></div></form></div></div>}
  </>;
}
