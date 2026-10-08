import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { preverLimpeza } from "@/modules/scouting/application/limpeza-de-duplicatas-service";
import type { OportunidadeParaLimpeza } from "@/modules/scouting/domain/limpeza-de-duplicatas";
import { ConfirmarLimpeza } from "./confirmar-limpeza";

export const dynamic = "force-dynamic";

const ROTULO_DO_STATUS: Record<OportunidadeParaLimpeza["status"], string> = {
  DRAFT: "Rascunho", QUALIFICATION: "Em análise", ACTIVE: "Ativa", SUSPENDED: "Suspensa", CLOSED: "Encerrada",
};

function Oportunidade({ item }: { item: OportunidadeParaLimpeza }) {
  return <Link className="font-bold text-brand underline-offset-2 hover:underline" href={`/opportunities/${item.id}`}>
    {item.code}
  </Link>;
}

function Detalhe({ item }: { item: OportunidadeParaLimpeza }) {
  const partes = [ROTULO_DO_STATUS[item.status], item.temProposta ? "com proposta" : undefined, item.fichas ? `${item.fichas} ficha(s)` : undefined]
    .filter(Boolean).join(" · ");
  return <span className="text-xs text-slate-500">{partes}</span>;
}

/**
 * Prévia da limpeza das duplicatas da aprovação do Buscador. Nada aqui grava:
 * a página só mostra o que a confirmação faria. Exclusiva de usuário mestre.
 */
export default async function DuplicatasPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorization?.isMaster) notFound();

  const { plano, licitacoes } = await preverLimpeza();
  const aEncerrar = plano.grupos.reduce((total, grupo) => total + grupo.encerrar.length, 0);
  const manuais = plano.grupos.reduce((total, grupo) => total + grupo.manual.length, 0);
  const nada = plano.licitacoes.size === 0 && plano.grupos.length === 0;

  return <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader eyebrow="Sistema" icon="dashboard" subtitle="A limpeza roda sozinha depois de cada aprovação e na varredura semanal do Buscador. Esta tela só mostra o que estiver pendente agora — o botão abaixo é opcional." title="Limpeza de duplicatas"/>

    <section className="mt-6 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Licitações a descartar da fila</p><p className="mt-1 text-3xl font-black text-slate-950">{plano.licitacoes.size}</p></div>
      <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Oportunidades a encerrar</p><p className="mt-1 text-3xl font-black text-slate-950">{aEncerrar}</p></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-800">Para decidir à mão</p><p className="mt-1 text-3xl font-black text-amber-900">{manuais}</p></div>
    </section>

    {nada && <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Nenhuma duplicata encontrada.</p>}

    {plano.grupos.length > 0 && <section className="mt-8">
      <h2 className="text-lg font-black text-slate-950">Oportunidades da mesma obra</h2>
      <p className="mt-1 text-sm text-slate-500">Fica a que mais avançou (depois: com proposta, com ficha, vinculada à licitação, mais antiga). As outras são <strong>encerradas</strong> com motivo &quot;Outro&quot; apontando a que ficou — nada é apagado, e cada uma pode ser reaberta pela própria tela.</p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Objeto</th><th className="px-4 py-3">Fica</th><th className="px-4 py-3">Será encerrada</th><th className="px-4 py-3">Decidir à mão</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {plano.grupos.map((grupo) => <tr className="align-top" key={grupo.fica.id}>
              <td className="max-w-[360px] px-4 py-3 text-slate-700">{grupo.fica.subject ?? "—"}</td>
              <td className="px-4 py-3"><div className="grid gap-0.5"><Oportunidade item={grupo.fica}/><Detalhe item={grupo.fica}/></div></td>
              <td className="px-4 py-3"><div className="grid gap-2">{grupo.encerrar.length ? grupo.encerrar.map((item) => <div className="grid gap-0.5" key={item.id}><Oportunidade item={item}/><Detalhe item={item}/></div>) : <span className="text-slate-400">—</span>}</div></td>
              <td className="px-4 py-3"><div className="grid gap-2">{grupo.manual.length ? grupo.manual.map((item) => <div className="grid gap-0.5" key={item.id}><Oportunidade item={item}/><Detalhe item={item}/></div>) : <span className="text-slate-400">—</span>}</div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>}

    {plano.licitacoes.size > 0 && <section className="mt-8">
      <h2 className="text-lg font-black text-slate-950">Licitações que saem da fila do Buscador</h2>
      <p className="mt-1 text-sm text-slate-500">Mesma obra de outra licitação. Ficam no histórico como descartadas, com o motivo.</p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Licitação</th><th className="px-4 py-3">Órgão</th><th className="px-4 py-3">Motivo</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {[...plano.licitacoes].map(([id, { jaAprovada }]) => {
              const licitacao = licitacoes.get(id);
              return <tr className="align-top" key={id}>
                <td className="max-w-[420px] px-4 py-3 text-slate-700">{licitacao?.subject ?? id}</td>
                <td className="px-4 py-3 text-slate-600">{licitacao?.authorityName}{licitacao?.city ? ` — ${licitacao.city}/${licitacao.state ?? ""}` : ""}</td>
                <td className="px-4 py-3 text-slate-600">{jaAprovada ? "A mesma obra já foi aprovada" : "Existe publicação mais recente"}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>}

    {!nada && <ConfirmarLimpeza licitacoes={plano.licitacoes.size} oportunidades={aEncerrar}/>}
  </main>;
}
