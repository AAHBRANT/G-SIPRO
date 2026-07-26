"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { GsIcon } from "@/components/ui/gs-icon";

export type NotificationSettingsView = Readonly<{
  emailSender: string | null;
  version: number;
  updatedAt: string;
}> | null;

export function NotificationSettingsManager({ settings, canConfigure }: { settings: NotificationSettingsView; canConfigure: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const emailSender = form.get("emailSender")?.toString().trim() || null;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/notification-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emailSender }),
      });
      const result = (await response.json()) as { error?: { message?: string } };
      setBusy(false);
      if (!response.ok) {
        setMessage(result.error?.message ?? "Não foi possível salvar o e-mail remetente.");
        return;
      }
      setMessage("E-mail remetente salvo.");
      router.refresh();
    } catch {
      setBusy(false);
      setMessage("Falha de conexão. Verifique sua rede e tente novamente.");
    }
  }

  return <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" id="notificacoes">
    <header className="flex flex-col justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <GsIcon className="h-4 w-4 text-brand" name="chart"/>
        <div>
          <h2 className="text-xs font-black uppercase tracking-wide text-slate-900">E-mail remetente das notificações</h2>
          <p className="mt-1 text-[10px] text-slate-500">Endereço usado como remetente quando o G-SIPRO envia e-mails de notificação. Precisa ser uma caixa que já existe no Microsoft 365 da empresa.</p>
        </div>
      </div>
    </header>

    {message && <p aria-live="polite" className="border-b border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900" role="status">{message}</p>}

    <form className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]" onSubmit={submit}>
      <label className="grid gap-1 text-xs font-bold text-slate-700">
        E-mail remetente
        <input
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal text-slate-800 disabled:bg-slate-50"
          defaultValue={settings?.emailSender ?? ""}
          disabled={!canConfigure}
          name="emailSender"
          placeholder="notificacoes@suaempresa.com"
          type="email"
        />
      </label>
      {canConfigure && (
        <button className="self-end rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" disabled={busy} type="submit">
          {busy ? "Salvando…" : "Salvar"}
        </button>
      )}
    </form>
    {!canConfigure && <p className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500">Somente o proprietário pode alterar o e-mail remetente.</p>}
    {settings && <p className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500">Última alteração: versão {settings.version}, em {new Date(settings.updatedAt).toLocaleString("pt-BR")}.</p>}
  </section>;
}
