import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { defaultScoutFilter } from "@/modules/scouting/domain/scout-filter";
import { PrismaScoutRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";
import { ScoutFilterForm } from "./scout-filter-form";

const runStatusLabels: Record<string, string> = { RUNNING: "Em execução", COMPLETED: "Concluída", FAILED: "Falhou" };
const triggerLabels: Record<string, string> = { SCHEDULED: "Automática", MANUAL: "Manual" };

export default async function ScoutingPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "opportunities.read" }).allowed) {
    return <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10"><section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-8"><p className="text-xs font-bold uppercase tracking-wider text-amber-800">Controle de acesso</p><h1 className="mt-2 text-2xl font-black text-amber-950">Acesso aguardando provisionamento</h1><p className="mt-3 leading-7 text-amber-900">Sua identidade foi reconhecida, mas nenhum perfil aprovado concede acesso ao Buscador. Solicite ao administrador a atribuição formal do perfil adequado.</p></section></main>;
  }

  const canUpdate = authorize(authorization, { permission: "opportunities.update" }).allowed;
  const [stored, runs, pending] = await Promise.all([
    new PrismaScoutRepository().loadFilter(),
    getDatabase().scoutRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 }),
    getDatabase().scoutedTender.count({ where: { status: "PENDING" } }),
  ]);

  return <main className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
    <PageHeader eyebrow="Buscador G-SIPRO" icon="search" subtitle="Define o que a varredura semanal procura e como trata cada condição do certame." title="Configuração de filtros" variant="executive"/>

    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-slate-600">
        <span>A varredura é executada <strong className="text-slate-900">semanalmente, aos domingos</strong>, quando o portal está mais estável e não há publicação de novos editais.</span>
        <span className="ml-auto">Aguardando triagem: <strong className="text-slate-900">{pending}</strong></span>
      </div>
    </section>

    <ScoutFilterForm filter={stored ?? defaultScoutFilter} readOnly={!canUpdate}/>

    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <header className="border-b border-slate-200 px-5 py-3"><h2 className="text-sm font-black uppercase tracking-wide text-slate-700">Últimas varreduras</h2></header>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs">
        <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Início</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Encontradas</th><th className="px-4 py-3">Enquadradas</th><th className="px-4 py-3">Novas na fila</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {runs.map((run) => <tr className="h-11" key={run.id}>
            <td className="px-4 py-2 text-slate-700">{run.startedAt.toLocaleString("pt-BR")}</td>
            <td className="px-4 py-2 text-slate-600">{triggerLabels[run.trigger] ?? run.trigger}</td>
            <td className="px-4 py-2 text-slate-600">{runStatusLabels[run.status] ?? run.status}</td>
            <td className="px-4 py-2 text-slate-600">{run.totalFetched}</td>
            <td className="px-4 py-2 text-slate-600">{run.totalQualified}</td>
            <td className="px-4 py-2 font-semibold text-slate-800">{run.totalNew}</td>
          </tr>)}
          {runs.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>Nenhuma varredura executada até o momento.</td></tr>}
        </tbody>
      </table></div>
    </section>
  </main>;
}
