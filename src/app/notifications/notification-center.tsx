"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type NotificationView = Readonly<{
  id: string;
  type: string;
  summary: string;
  nextAction: string;
  deepLink: string;
  readAt: string | null;
  createdAt: string;
}>;

function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function NotificationCenter({ initialNotifications }: { initialNotifications: readonly NotificationView[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const visible = unreadOnly ? notifications.filter((item) => !item.readAt) : notifications;

  async function openNotification(notification: NotificationView) {
    setBusyId(notification.id);
    if (!notification.readAt) {
      const response = await fetch(`/api/notifications/${notification.id}/read`, { method: "POST" });
      if (response.ok) {
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      }
    }
    setBusyId(null);
    router.push(notification.deepLink);
    router.refresh();
  }

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-col justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center">
      <div><h2 className="text-xs font-black uppercase tracking-wide text-slate-900">Central de notificações</h2><p className="mt-1 text-[10px] text-slate-500">Avisos persistentes e encaminhamentos gerados pelo G-SIPRO.</p></div>
      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600"><input checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} type="checkbox"/> Somente não lidas</label>
    </header>
    <div className="divide-y divide-slate-100">
      {visible.map((notification) => <article className={`grid gap-3 px-4 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center ${notification.readAt ? "bg-white" : "bg-blue-50/40"}`} key={notification.id}>
        <span aria-label={notification.readAt ? "Lida" : "Não lida"} className={`h-2.5 w-2.5 rounded-full ${notification.readAt ? "bg-slate-200" : "bg-brand"}`}/>
        <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-slate-600">{humanize(notification.type)}</span><time className="text-[9px] text-slate-400">{new Date(notification.createdAt).toLocaleString("pt-BR")}</time></div><h3 className="mt-2 text-sm font-black text-slate-900">{notification.summary}</h3><p className="mt-1 text-xs leading-5 text-slate-500"><strong>Próxima ação:</strong> {notification.nextAction}</p></div>
        <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-brand disabled:opacity-50" disabled={busyId === notification.id} onClick={() => openNotification(notification)} type="button">{busyId === notification.id ? "Abrindo…" : "Abrir"}</button>
      </article>)}
      {visible.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhuma notificação encontrada.</p>}
    </div>
  </section>;
}
