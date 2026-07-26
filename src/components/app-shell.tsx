"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type NavigationItem = Readonly<{ href: string; label: string; icon: ReactNode; permission?: string; badge?: number; exact?: boolean }>;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

const icons = {
  dashboard: <Icon><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>,
  opportunity: <Icon><path d="M4 19h16M6 16V8m6 8V4m6 12v-5"/><path d="m5 7 6-4 6 6 3-2"/></Icon>,
  tender: <Icon><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h5M10 12h6M10 16h6"/></Icon>,
  proposal: <Icon><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></Icon>,
  competition: <Icon><path d="M12 3v18M5 7h14M6 7l-3 5h6L6 7Zm12 0-3 5h6l-3-5Z"/><path d="M8 21h8"/></Icon>,
  archive: <Icon><path d="M4 7h16v14H4zM3 3h18v4H3zM9 11h6"/></Icon>,
  matrix: <Icon><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></Icon>,
  indicators: <Icon><path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/></Icon>,
  admin: <Icon><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M19 4v4M17 6h4"/></Icon>,
  ai: <Icon><path d="M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"/><path d="M9 9h.01M15 9h.01M9 15c2 1.5 4 1.5 6 0"/></Icon>,
  document: <Icon><path d="M6 3h9l4 4v14H6zM15 3v5h5M9 12h7M9 16h7"/></Icon>,
  support: <Icon><path d="M4 5h16v12H8l-4 4V5Z"/><path d="M9 9h6M9 13h4"/></Icon>,
  notification: <Icon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></Icon>,
  calendar: <Icon><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></Icon>,
};

const navigation: ReadonlyArray<NavigationItem> = [
  { href: "/", label: "Visão geral", icon: icons.dashboard },
  { href: "/opportunities", label: "Oportunidades", icon: icons.opportunity, permission: "opportunities.read" },
  { href: "/proposals", label: "Propostas", icon: icons.proposal, permission: "proposals.read" },
  { href: "/technical-archive", label: "Acervo técnico", icon: icons.archive, permission: "technical-archive.read" },
  { href: "/indicators", label: "Inteligência e KPIs", icon: icons.indicators, permission: "indicators.read" },
  { href: "/calendar", label: "Agenda", icon: icons.calendar, permission: "calendar.read" },
];

function Navigation({ close, isMaster = false, isOwner = false, pendingApprovals = 0, unreadNotifications = 0, permissions }: { close?: () => void; isMaster?: boolean; isOwner?: boolean; pendingApprovals?: number; unreadNotifications?: number; permissions: ReadonlyArray<string> }) {
  const pathname = usePathname();
  const granted = new Set(permissions);
  const mainItems = navigation.filter((item) => isMaster || !item.permission || granted.has(item.permission));
  if (isMaster) mainItems.push({ href: "/admin", label: "Administrador", icon: icons.admin, exact: true });
  const bottomItems: ReadonlyArray<NavigationItem> = [
    ...(granted.has("notifications.read") || isMaster ? [{ href: "/notifications", label: "Notificações", icon: icons.notification, badge: unreadNotifications }] : []),
    { href: "/support", label: "Suporte", icon: icons.support },
    ...(isOwner ? [{ href: "/admin/support#approvals", label: "Aprovações", icon: icons.support, badge: pendingApprovals }] : []),
  ];
  const renderItems = (items: ReadonlyArray<NavigationItem>) => <ul className="space-y-1">{items.map(item => {
      const active = item.exact || item.href === "/" ? pathname === item.href : pathname.startsWith(item.href.split("#")[0]);
      return <li key={item.href}><Link aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--brand)]" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`} href={item.href} onClick={close}>{item.icon}<span>{item.label}</span>{Boolean(item.badge) && <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-black text-white">{item.badge}</span>}</Link></li>;
    })}</ul>;
  return <nav className="flex min-h-0 flex-1 flex-col px-3 py-4">
    <div className="flex-1 overflow-y-auto">{renderItems(mainItems)}</div>
    <div className="mt-4 shrink-0 border-t border-white/10 pt-4">{renderItems(bottomItems)}</div>
  </nav>;
}

export function AppShell({ children, userLabel, isMaster = false, isOwner = false, pendingApprovals = 0, unreadNotifications = 0, permissions = [], signOutAction }: { children: ReactNode; userLabel: string; isMaster?: boolean; isOwner?: boolean; pendingApprovals?: number; unreadNotifications?: number; permissions?: ReadonlyArray<string>; signOutAction: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const initials = userLabel.split(/[\s.@]+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "GS";

  return <div className="min-h-screen bg-background">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-800 bg-[#1d1e21] md:flex">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-sm font-black text-white shadow-md shadow-black/20">GS</div>
        <div><p className="text-lg font-black leading-none text-white">G-SIPRO</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Gestão de propostas</p></div>
      </div>
      <Navigation isMaster={isMaster} isOwner={isOwner} pendingApprovals={pendingApprovals} permissions={permissions} unreadNotifications={unreadNotifications}/>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-white">{initials}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{userLabel}</p><p className="text-[10px] text-slate-400">{isOwner ? "Proprietário" : isMaster ? "Usuário mestre" : "Acesso corporativo"}</p></div>
          <form action={signOutAction}><button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" title="Sair" type="submit"><Icon><path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></Icon></button></form>
        </div>
      </div>
    </aside>

    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800 bg-[#1d1e21] px-4 text-white md:hidden">
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-xs font-black text-white">GS</div><strong>G-SIPRO</strong></div>
      <button aria-label="Abrir menu" className="rounded-lg border border-white/15 p-2 text-slate-200" onClick={() => setOpen(true)}><Icon><path d="M4 7h16M4 12h16M4 17h16"/></Icon></button>
    </header>
    {open && <div className="fixed inset-0 z-50 md:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)}/><aside className="relative flex h-full w-[86%] max-w-80 flex-col bg-[#1d1e21] text-white shadow-2xl"><div className="flex h-16 items-center justify-between border-b border-white/10 px-5"><strong>G-SIPRO</strong><button className="p-2 text-slate-300" onClick={() => setOpen(false)}><Icon><path d="m6 6 12 12M18 6 6 18"/></Icon></button></div><Navigation close={() => setOpen(false)} isMaster={isMaster} isOwner={isOwner} pendingApprovals={pendingApprovals} permissions={permissions} unreadNotifications={unreadNotifications}/></aside></div>}
    <div className="md:pl-64">{isOwner && pendingApprovals > 0 && <Link className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6" href="/admin/support#approvals"><span><strong>{pendingApprovals} solicitação(ões) requerem sua ação.</strong> Aprove mudanças, execute orientações administrativas protegidas ou assuma exceções diretamente no G-SIPRO.</span><span className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-white">Abrir pendências</span></Link>}<main className="min-h-screen">{children}</main></div>
    <Link aria-label="Abrir suporte" className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-950/15 transition hover:-translate-y-0.5 hover:bg-[var(--brand-strong)]" href={`/support?from=${encodeURIComponent(pathname)}`}>{icons.support}<span className="hidden sm:inline">Suporte</span></Link>
  </div>;
}
