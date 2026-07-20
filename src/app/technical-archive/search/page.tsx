import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAuthorizationContext } from "@/core/authorization/authorization-context";
import { authorize } from "@/core/authorization/policy";
import { ArchiveSearchService, type ArchiveSearchResult } from "@/modules/technical-archive/application/archive-search-service";
import { archiveSearchSchema } from "@/modules/technical-archive/domain/archive-search";
import { PrismaArchiveSearchRepository } from "@/modules/technical-archive/infrastructure/prisma-archive-search-repository";

type Parameters = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

function pageLink(parameters: Parameters, page: number) {
  const query = new URLSearchParams();
  for (const key of ["discipline", "service", "characteristic", "minQuantity", "maxQuantity", "unit", "pageSize"]) {
    const value = first(parameters[key]);
    if (value) query.set(key, value);
  }
  query.set("page", String(page));
  return `/technical-archive/search?${query.toString()}`;
}

export default async function TechnicalArchiveSearchPage({ searchParams }: { searchParams: Promise<Parameters> }) {
  const authorization = await getCurrentAuthorizationContext();
  if (!authorize(authorization, { permission: "technical-archive.search" }).allowed) notFound();
  const parameters = await searchParams;
  const raw = {
    discipline: first(parameters.discipline), service: first(parameters.service), characteristic: first(parameters.characteristic),
    minQuantity: first(parameters.minQuantity), maxQuantity: first(parameters.maxQuantity), unit: first(parameters.unit),
    page: first(parameters.page), pageSize: first(parameters.pageSize),
  };
  const hasFilter = [raw.discipline, raw.service, raw.characteristic, raw.minQuantity, raw.maxQuantity, raw.unit].some(value => typeof value === "string" && value.trim());
  const parsed = hasFilter ? archiveSearchSchema.safeParse(raw) : null;
  let result: ArchiveSearchResult | null = null;
  if (parsed?.success) result = await new ArchiveSearchService(new PrismaArchiveSearchRepository()).search(parsed.data, authorization!.actorId);
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
    <header>
      <Link className="text-sm font-bold text-brand" href="/technical-archive">← Acervo técnico</Link>
      <h1 className="mt-6 text-3xl font-bold">Pesquisa controlada do acervo</h1>
      <p className="mt-2 text-muted">Consulte serviços preservando descrição original, unidade, fonte e evidência documental.</p>
    </header>

    <form className="grid gap-4 rounded-2xl border border-border bg-surface p-5 md:grid-cols-3" method="get">
      <label className="grid gap-1 text-sm font-bold">Disciplina<input className="rounded-xl border border-border bg-background px-3 py-2 font-normal" defaultValue={raw.discipline} maxLength={120} name="discipline" placeholder="Ex.: saneamento" /></label>
      <label className="grid gap-1 text-sm font-bold">Descrição do serviço<input className="rounded-xl border border-border bg-background px-3 py-2 font-normal" defaultValue={raw.service} maxLength={500} name="service" placeholder="Texto contido na descrição original" /></label>
      <label className="grid gap-1 text-sm font-bold">Característica<input className="rounded-xl border border-border bg-background px-3 py-2 font-normal" defaultValue={raw.characteristic} maxLength={500} name="characteristic" placeholder="Ex.: diâmetro, material, método" /></label>
      <label className="grid gap-1 text-sm font-bold">Quantitativo mínimo<input className="rounded-xl border border-border bg-background px-3 py-2 font-normal" defaultValue={raw.minQuantity} min="0" name="minQuantity" step="any" type="number" /></label>
      <label className="grid gap-1 text-sm font-bold">Quantitativo máximo<input className="rounded-xl border border-border bg-background px-3 py-2 font-normal" defaultValue={raw.maxQuantity} min="0" name="maxQuantity" step="any" type="number" /></label>
      <label className="grid gap-1 text-sm font-bold">Unidade<input className="rounded-xl border border-border bg-background px-3 py-2 font-normal" defaultValue={raw.unit} maxLength={40} name="unit" placeholder="Ex.: m, m², m³" /></label>
      <input name="pageSize" type="hidden" value="25" />
      <div className="flex flex-wrap gap-3 md:col-span-3"><button className="rounded-xl bg-brand px-5 py-2 font-bold text-white" type="submit">Pesquisar</button><Link className="rounded-xl border border-border px-5 py-2 font-bold" href="/technical-archive/search">Limpar</Link></div>
      <p className="text-xs text-muted md:col-span-3">A unidade é obrigatória para faixas quantitativas. Não há conversão automática entre unidades.</p>
    </form>

    {parsed && !parsed.success && <section className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"><strong>Revise os filtros:</strong> {parsed.error.issues.map(issue => issue.message).join(" ")}</section>}
    {!hasFilter && <section className="rounded-2xl border border-border bg-surface p-8 text-center text-muted">Informe ao menos um filtro para iniciar a pesquisa. Essa limitação evita consultas indiscriminadas ao acervo.</section>}

    {result && <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-bold">Resultados ({result.total})</h2><span className="text-sm text-muted">Página {result.page} de {totalPages}</span></div>
      {result.items.map(item => <article className="rounded-2xl border border-border bg-surface p-5" key={item.serviceId}>
        <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold text-brand">{item.discipline} · {item.contract.code}</p><h3 className="mt-1 text-lg font-bold">{item.originalDescription}</h3></div><span className="text-sm font-bold">{item.contract.status}</span></div>
        <p className="mt-3 text-sm"><strong>Características:</strong> {item.characteristics}</p>
        <p className="mt-2 text-sm"><strong>Quantitativos:</strong> {item.quantities.map(quantity => `${quantity.value} ${quantity.unit}`).join(" · ")}</p>
        {item.quantities.map(quantity => <p className="mt-1 text-xs text-muted" key={`${quantity.value}-${quantity.unit}-${quantity.source}`}>Fonte do quantitativo {quantity.value} {quantity.unit}: {quantity.source}</p>)}
        <div className="mt-3 border-t border-border pt-3 text-sm text-muted">
          <p>Contrato: {item.contract.subject} · {item.contract.contractorName} · {item.contract.startedAt.toLocaleDateString("pt-BR")} a {item.contract.endedAt.toLocaleDateString("pt-BR")}</p>
          {item.work && <p>Obra: {item.work.name} · {item.work.type} · {item.work.location}</p>}
          <p>Evidência: {item.evidence.documentTitle} · versão {item.evidence.version} · hash {item.evidence.fileHash}</p>
        </div>
      </article>)}
      {result.items.length === 0 && <p className="rounded-2xl border border-border bg-surface p-10 text-center text-muted">Nenhum serviço corresponde aos filtros informados.</p>}
      {totalPages > 1 && <nav className="flex justify-center gap-3">{result.page > 1 && <Link className="rounded-xl border border-border px-4 py-2 font-bold" href={pageLink(parameters, result.page - 1)}>← Anterior</Link>}{result.page < totalPages && <Link className="rounded-xl border border-border px-4 py-2 font-bold" href={pageLink(parameters, result.page + 1)}>Próxima →</Link>}</nav>}
    </section>}
  </main>;
}

