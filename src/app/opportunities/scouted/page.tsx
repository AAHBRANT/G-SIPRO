import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { TriageActions } from "./triage-actions";

const currency = (value: { toString(): string } | null, undisclosed: boolean) => {
  if (undisclosed || value === null) return "Sigiloso";
  return Number(value.toString()).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

const sphereLabels: Record<string, string> = { F: "Federal", E: "Estadual", M: "Municipal", D: "Distrital" };

export default async function ScoutedTendersPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "opportunities.read" }).allowed) {
    return <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10"><section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Controle de acesso</p><h1 className="mt-2 text-2xl font-black text-amber-950">Acesso aguardando provisionamento</h1><p className="mt-3 leading-7 text-amber-900">Nenhum perfil aprovado concede consulta às licitações rastreadas.</p></section></main>;
  }

  // Aprovar cria uma oportunidade: exige a mesma alçada do cadastro manual.
  const canDecide = authorize(authorization, { permission: "opportunities.create" }).allowed;
  const [tenders, lastRun] = await Promise.all([
    getDatabase().scoutedTender.findMany({ where: { status: "PENDING" }, orderBy: [{ proposalClosesAt: "asc" }, { createdAt: "desc" }], take: 200 }),
    getDatabase().scoutRun.findFirst({ where: { status: "COMPLETED" }, orderBy: { startedAt: "desc" } }),
  ]);

  return <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
    <Link className="text-sm font-bold text-brand hover:underline" href="/opportunities">← Voltar às oportunidades</Link>
    <div className="mt-3">
      <PageHeader eyebrow="Buscador G-SIPRO" icon="search" subtitle="Licitações captadas na varredura, aguardando decisão da equipe. Aprovar cadastra a oportunidade automaticamente." title="Oportunidades rastreadas" variant="executive"/>
    </div>

    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700">
          Relação de rastreadas
          {tenders.length > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black text-brand">{tenders.length} aguardando triagem</span>}
        </h2>
        {lastRun && <span className="text-[11px] text-slate-500">Última varredura: <strong className="text-slate-700">{lastRun.startedAt.toLocaleDateString("pt-BR")}</strong></span>}
      </header>

      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] table-fixed text-left text-xs">
        <colgroup><col className="w-[32%]"/><col className="w-[12%]"/><col className="w-[16%]"/><col className="w-[10%]"/><col className="w-[8%]"/><col className="w-[22%]"/></colgroup>
        <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-3">Licitação</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Localidade</th><th className="px-4 py-3">Encerra</th><th className="px-4 py-3">Edital</th><th className="px-4 py-3 text-center">Decisão</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tenders.map((tender) => <tr className="transition hover:bg-blue-50/30" key={tender.id}>
            <td className="px-4 py-3">
              <p className="truncate font-semibold text-slate-900" title={tender.subject}>{tender.subject}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">{tender.modality} · {tender.authorityName} · {sphereLabels[tender.sphere] ?? tender.sphere}</p>
            </td>
            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{currency(tender.estimatedValue, tender.valueUndisclosed)}</td>
            <td className="px-4 py-3"><span className="block truncate text-slate-600">{tender.city ? `${tender.city} / ${tender.state ?? ""}` : tender.state ?? "—"}</span></td>
            <td className="whitespace-nowrap px-4 py-3 text-slate-600">{tender.proposalClosesAt ? tender.proposalClosesAt.toLocaleDateString("pt-BR") : "—"}</td>
            <td className="px-4 py-3">{tender.noticeUrl ? <a className="font-semibold text-brand hover:underline" href={tender.noticeUrl} rel="noreferrer" target="_blank">PNCP ↗</a> : <span className="text-slate-400">—</span>}</td>
            <td className="px-4 py-3">{canDecide ? <TriageActions id={tender.id}/> : <span className="block text-center text-[10px] text-slate-400">Sem alçada para decidir</span>}</td>
          </tr>)}
          {tenders.length === 0 && <tr><td className="px-4 py-12 text-center text-slate-500" colSpan={6}>Nenhuma licitação aguardando triagem. A próxima varredura ocorre no domingo.</td></tr>}
        </tbody>
      </table></div>
    </section>
  </main>;
}
