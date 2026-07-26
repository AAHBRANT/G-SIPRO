"use client";

import { app, authentication } from "@microsoft/teams-js";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

type TeamsState = "CONNECTING" | "AUTHENTICATING" | "READY" | "ERROR";

export default function TeamsEntryPage() {
  const [state, setState] = useState<TeamsState>("CONNECTING");
  const [message, setMessage] = useState("Conectando ao Microsoft Teams...");

  useEffect(() => {
    let active = true;
    async function connect() {
      try {
        await app.initialize();
        if (!active) return;
        setState("AUTHENTICATING");
        setMessage("Validando sua identidade corporativa...");
        const teamsToken = await authentication.getAuthToken();
        const result = await signIn("teams-sso", { teamsToken, redirect: false });
        if (!result || result.error) throw new Error("Seu usuário não está liberado no G-SIPRO.");
        if (!active) return;
        setState("READY");
        setMessage("Acesso confirmado. Abrindo o G-SIPRO...");
        const context = await app.getContext();
        const target = context.page.subPageId;
        window.location.replace(target && target.startsWith("/") ? target : "/");
      } catch (error) {
        if (!active) return;
        setState("ERROR");
        setMessage(error instanceof Error ? error.message : "Não foi possível autenticar pelo Teams.");
      }
    }
    void connect();
    return () => { active = false; };
  }, []);

  return <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-slate-50 px-5 py-10"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand text-lg font-black text-white">GS</div><p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-brand">Microsoft Teams</p><h1 className="mt-2 text-2xl font-black text-slate-950">G-SIPRO</h1><p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>{state !== "ERROR" && <span className="mx-auto mt-6 block h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-brand"/>}{state === "ERROR" && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-xs leading-5 text-amber-900"><strong>Acesso não concluído</strong><p className="mt-1">Confirme se seu e-mail foi cadastrado pelo usuário mestre e tente novamente.</p><div className="mt-3 flex flex-wrap gap-3"><button className="font-bold text-brand hover:underline" onClick={() => window.location.reload()} type="button">Tentar novamente</button><a className="font-bold text-brand hover:underline" href="/" rel="noreferrer" target="_blank">Abrir no navegador</a></div></div>}</section></main>;
}
