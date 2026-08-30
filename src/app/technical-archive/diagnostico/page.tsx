import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { getDatabase } from "@/core/database/prisma";
import { diagnoseArchive, diagnoseQueue } from "@/modules/scouting/domain/archive-diagnosis";
import { PrismaArchiveEvidenceRepository } from "@/modules/scouting/infrastructure/prisma-scouting-repository";

/**
 * Diagnóstico do catálogo contra o acervo real.
 *
 * Existe porque a pergunta "o sistema entende o vocabulário dos nossos
 * atestados?" não se responde com dado inventado, e quem precisa da resposta
 * não deveria precisar de credencial de banco para obtê-la. É leitura pura:
 * nada aqui grava, apaga ou dispara processo.
 */
export const dynamic = "force-dynamic";

const Barra = ({ n, total }: { n: number; total: number }) => (
  <span className="inline-block h-2 rounded-full bg-brand/70 align-middle" style={{ width: `${Math.round((n / Math.max(total, 1)) * 160)}px` }}/>
);

export default async function DiagnosticoDoAcervoPage() {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "technical-archive.read" }).allowed) notFound();

  const [archive, fila] = await Promise.all([
    new PrismaArchiveEvidenceRepository().loadEvidence(),
    getDatabase().scoutedTender.findMany({
      where: { status: "PENDING" },
      select: { subject: true, estimatedValue: true, valueUndisclosed: true },
    }),
  ]);

  const acervo = diagnoseArchive(archive);
  const triagem = diagnoseQueue(
    fila.map((t) => ({
      subject: t.subject,
      ...(t.valueUndisclosed || t.estimatedValue === null ? {} : { estimatedValue: Number(t.estimatedValue) }),
    })),
    archive,
  );

  const semCobertura = acervo.coverage.filter((c) => c.count === 0);

  return <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 lg:py-8">
    <p className="text-xs font-bold uppercase tracking-wider text-brand">Acervo técnico</p>
    <h1 className="mt-1 text-3xl font-black">Diagnóstico do catálogo</h1>
    <p className="mt-2 max-w-3xl text-sm text-slate-600">
      Confronta o vocabulário do catálogo de serviços com o acervo cadastrado. Serve para saber
      se a triagem está enxergando o que a empresa sabe fazer — e onde ela está enxergando
      grosso demais. <strong>Somente leitura.</strong>
    </p>
    <Link className="mt-3 inline-block text-sm font-bold text-brand underline" href="/technical-archive">← Voltar ao acervo</Link>

    <section className="mt-7 grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Serviços no acervo</p>
        <p className="mt-1 text-3xl font-black">{acervo.services.toLocaleString("pt-BR")}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Com valor de contrato</p>
        <p className="mt-1 text-3xl font-black">{acervo.withContractValue.toLocaleString("pt-BR")}</p>
        {acervo.withContractValue === 0 && <p className="mt-1 text-xs text-slate-500">Sem valor, a comparação de porte fica de fora e a nota máxima passa a ser 80.</p>}
      </div>
      <div className={`rounded-2xl border p-4 ${acervo.orphans > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Não reconhecidos</p>
        <p className="mt-1 text-3xl font-black">{acervo.orphans.toLocaleString("pt-BR")}</p>
        <p className="mt-1 text-xs text-slate-500">
          {acervo.services > 0 ? `${Math.round((acervo.orphans / acervo.services) * 100)}% do acervo` : "—"} invisível para a triagem
        </p>
      </div>
    </section>

    {acervo.orphanDisciplines.length > 0 && <section className="mt-7">
      <h2 className="text-xl font-black">Disciplinas que o catálogo não conhece</h2>
      <p className="mt-1 text-sm text-slate-600">É esta lista que corrige o catálogo com dado real, em vez de palpite.</p>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Disciplina, como está escrita no atestado</th><th className="p-3 text-right">Serviços</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {acervo.orphanDisciplines.map((d) => <tr key={d.label}><td className="p-3">{d.label}</td><td className="p-3 text-right font-bold tabular-nums">{d.count}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>}

    {acervo.conflations.length > 0 && <section className="mt-7">
      <h2 className="text-xl font-black">Categorias que juntam obras diferentes</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Quando duas disciplinas caem na mesma categoria, um atestado de uma passa a cobrir a
        exigência da outra. <strong>É o erro que dá &ldquo;atende&rdquo; falso</strong> — o que faz montar
        proposta e ser inabilitado. Separar é decisão de quem conhece a obra.
      </p>
      <div className="mt-3 grid gap-2">
        {acervo.conflations.map((c) => <div className="rounded-xl border border-slate-200 p-3" key={c.category}>
          <p className="text-sm font-bold">{c.category}</p>
          <p className="mt-1 text-xs text-slate-600">{c.disciplines.join("  ·  ")}</p>
        </div>)}
      </div>
    </section>}

    <section className="mt-7">
      <h2 className="text-xl font-black">Cobertura do catálogo</h2>
      <p className="mt-1 text-sm text-slate-600">Quantos serviços do acervo sustentam cada categoria.</p>
      <div className="mt-3 grid gap-1">
        {acervo.coverage.filter((c) => c.count > 0).map((c) => <div className="flex items-center gap-3 text-sm" key={c.label}>
          <span className="w-56 shrink-0 text-slate-700">{c.label}</span>
          <Barra n={c.count} total={acervo.coverage[0]?.count ?? 1}/>
          <span className="font-bold tabular-nums">{c.count}</span>
        </div>)}
      </div>
      {semCobertura.length > 0 && <p className="mt-3 text-xs text-slate-500">
        <strong>Sem nenhum serviço no acervo:</strong> {semCobertura.map((c) => c.label).join(", ")}.
        Exigência dessas categorias sai sempre como falta.
      </p>}
    </section>

    <section className="mt-8 border-t border-slate-200 pt-6">
      <h2 className="text-xl font-black">A fila de triagem contra este acervo</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Aqui a exigência é <strong>deduzida do objeto</strong>, como na tela enquanto o edital não é
        lido. Serve para medir a régua, não para decidir licitação.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[["Na fila", triagem.total], ["Com acervo julgado", triagem.judged], ["Indicam consórcio", triagem.needsPartner]].map(([rotulo, n]) =>
          <div className="rounded-2xl border border-slate-200 p-4" key={String(rotulo)}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{rotulo}</p>
            <p className="mt-1 text-3xl font-black">{Number(n).toLocaleString("pt-BR")}</p>
          </div>)}
      </div>

      {triagem.judged > 0 && <div className="mt-5">
        <h3 className="font-black">Distribuição das notas</h3>
        <div className="mt-2 grid gap-1">
          {triagem.bands.map((f) => <div className="flex items-center gap-3 text-sm" key={f.label}>
            <span className="w-20 shrink-0 text-right text-slate-700">{f.label}</span>
            <Barra n={f.count} total={triagem.judged}/>
            <span className="font-bold tabular-nums">{f.count}</span>
          </div>)}
        </div>
      </div>}

      {triagem.unjudged.length > 0 && <div className="mt-5">
        <h3 className="font-black">Por que ficaram sem julgamento</h3>
        <ul className="mt-2 grid gap-1 text-sm text-slate-700">
          {triagem.unjudged.map((m) => <li key={m.label}><strong className="tabular-nums">{m.count}×</strong> {m.label}</li>)}
        </ul>
      </div>}

      {triagem.missing.length > 0 && <div className="mt-5">
        <h3 className="font-black">Serviços que mais faltam</h3>
        <ul className="mt-2 grid gap-1 text-sm text-slate-700">
          {triagem.missing.slice(0, 15).map((m) => <li key={m.label}><strong className="tabular-nums">{m.count}×</strong> {m.label}</li>)}
        </ul>
      </div>}

      {triagem.unreadable.length > 0 && <div className="mt-5">
        <h3 className="font-black">Parcelas que o sistema não soube classificar</h3>
        <p className="mt-1 text-sm text-slate-600">Não foram conferidas contra o acervo — aparecem no cartão com essa ressalva.</p>
        <ul className="mt-2 grid gap-1 text-sm text-slate-700">
          {triagem.unreadable.slice(0, 20).map((m) => <li key={m.label}><strong className="tabular-nums">{m.count}×</strong> {m.label}</li>)}
        </ul>
      </div>}
    </section>
  </div>;
}
