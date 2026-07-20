"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type NavigationItem = Readonly<{ href: string; label: string; icon: ReactNode; permission?: string }>;
type NavigationGroup = Readonly<{ label: string; items: ReadonlyArray<NavigationItem> }>;

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
};

const navigation: ReadonlyArray<NavigationGroup> = [
  { label: "Visão geral", items: [{ href: "/", label: "Dashboard", icon: icons.dashboard }] },
  { label: "Comercial", items: [
    { href: "/opportunities", label: "Oportunidades", icon: icons.opportunity, permission: "opportunities.read" },
    { href: "/proposals", label: "Propostas", icon: icons.proposal, permission: "proposals.read" },
  ]},
  { label: "Acervo técnico", items: [
    { href: "/technical-archive", label: "Acervo técnico", icon: icons.archive, permission: "technical-archive.read" },
  ]},
  { label: "Inteligência", items: [
    { href: "/indicators", label: "Inteligência e KPIs", icon: icons.indicators, permission: "indicators.read" },
  ]},
  { label: "Atendimento", items: [
    { href: "/support", label: "Suporte", icon: icons.support },
  ]},
];

function Navigation({ close, isMaster = false, permissions }: { close?: () => void; isMaster?: boolean; permissions: ReadonlyArray<string> }) {
  const pathname = usePathname();
  const granted = new Set(permissions);
  const groups = navigation.map((group) => ({ ...group, items: group.items.filter((item) => isMaster || !item.permission || granted.has(item.permission)) })).filter((group) => group.items.length > 0);
  if (isMaster) groups.push({ label: "Sistema", items: [{ href: "/admin", label: "Administrador", icon: icons.admin }] });
  return <nav className="flex-1 overflow-y-auto px-3 pb-6 pt-4">{groups.map(group => <section className="mb-5" key={group.label}>
    <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{group.label}</p>
    <ul className="mt-2 space-y-1">{group.items.map(item => {
      const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
      return <li key={item.href}><Link aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-blue-50 text-brand shadow-sm ring-1 ring-blue-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`} href={item.href} onClick={close}>{item.icon}<span>{item.label}</span></Link></li>;
    })}</ul>
  </section>)}</nav>;
}

export function AppShell({ children, userLabel, isMaster = false, permissions = [], signOutAction }: { children: ReactNode; userLabel: string; isMaster?: boolean; permissions?: ReadonlyArray<string>; signOutAction: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const initials = userLabel.split(/[\s.@]+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "GS";

  return <div className="min-h-screen bg-background">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-sm font-black text-white shadow-md shadow-blue-900/20">GS</div>
        <div><p className="text-lg font-black leading-none text-slate-950">G-SIPRO</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Gestão de propostas</p></div>
      </div>
      <Navigation isMaster={isMaster} permissions={permissions}/>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{userLabel}</p><p className="text-[10px] text-slate-500">Acesso corporativo</p></div>
          <form action={signOutAction}><button className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-900" title="Sair" type="submit"><Icon><path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></Icon></button></form>
        </div>
      </div>
    </aside>

    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:hidden">
      <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-xs font-black text-white">GS</div><strong>G-SIPRO</strong></div>
      <button aria-label="Abrir menu" className="rounded-lg border border-slate-200 p-2" onClick={() => setOpen(true)}><Icon><path d="M4 7h16M4 12h16M4 17h16"/></Icon></button>
    </header>
    {open && <div className="fixed inset-0 z-50 md:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-slate-950/40" onClick={() => setOpen(false)}/><aside className="relative flex h-full w-[86%] max-w-80 flex-col bg-white shadow-2xl"><div className="flex h-16 items-center justify-between border-b px-5"><strong>G-SIPRO</strong><button className="p-2" onClick={() => setOpen(false)}><Icon><path d="m6 6 12 12M18 6 6 18"/></Icon></button></div><Navigation close={() => setOpen(false)} isMaster={isMaster} permissions={permissions}/></aside></div>}
    <div className="md:pl-64"><main className="min-h-screen">{children}</main></div>
    <Link aria-label="Abrir suporte" className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-brand" href={`/support?from=${encodeURIComponent(pathname)}`}>{icons.support}<span className="hidden sm:inline">Suporte</span></Link>
  </div>;
}
