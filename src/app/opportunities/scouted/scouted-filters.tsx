"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type FilterGroup = Readonly<{
  key: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string; count: number }>;
}>;

const lupa = <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.1" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/></svg>;

/**
 * Barra lateral de filtros da fila de triagem.
 *
 * É a estrutura do protótipo aprovado: coluna fixa à esquerda, cabeçalho preto
 * com "Limpar tudo" grudado no topo, e cada filtro numa seção com título — tudo
 * à vista, sem menu suspenso. A versão anterior escondia cada grupo atrás de um
 * chip que abria um menu; para saber o que estava filtrado era preciso abrir um
 * por um.
 *
 * ⚠️ A barra é mais alta que a tela. `position: sticky` com teto de altura e
 * rolagem própria (no CSS) é o que permite alcançar os últimos filtros sem
 * perder os primeiros de vista. Nada aqui mede posição nem observa rolagem.
 *
 * O estado vive na barra de endereço: a seleção sobrevive a recarregar a página
 * e pode ser passada por link para outra pessoa.
 */
export function ScoutedFilters({ groups, sortOptions }: { groups: ReadonlyArray<FilterGroup>; sortOptions: ReadonlyArray<{ value: string; label: string }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  const adherenceParam = Number(params.get("ader") ?? 0);
  const adherenceFloor = Number.isFinite(adherenceParam) ? Math.max(0, Math.min(100, adherenceParam)) : 0;

  function apply(next: URLSearchParams) {
    next.delete("page");
    const search = next.toString();
    router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  const selected = (key: string): string[] => params.getAll(key);

  function toggle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const current = next.getAll(key);
    next.delete(key);
    const after = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    for (const entry of after) next.append(key, entry);
    apply(next);
  }

  function setSingle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    apply(next);
  }

  return <aside className="bx-lado">
    <div className="bx-lado-cab">
      <h2>Filtros</h2>
      <button onClick={() => { setQuery(""); router.push(pathname, { scroll: false }); }} type="button">Limpar tudo</button>
    </div>

    <div className="bx-secao">
      <form className="bx-busca" onSubmit={(event) => { event.preventDefault(); setSingle("q", query.trim()); }} style={{ height: 34 }}>
        {lupa}
        <input aria-label="Buscar" onChange={(event) => setQuery(event.target.value)} placeholder="Objeto, órgão, cidade, processo…" value={query}/>
      </form>
    </div>

    <div className="bx-secao">
      <h3>Aderência ao perfil</h3>
      <AdherenceRange floor={adherenceFloor} key={adherenceFloor} onCommit={(value) => setSingle("ader", value > 0 ? String(value) : "")}/>
    </div>

    <div className="bx-secao">
      <h3>Valor estimado</h3>
      <div className="bx-par-campos">
        <Numero chave="vmin" dica="14.000.000" params={params} rotulo="Mínimo" onCommit={setSingle}/>
        <Numero chave="vmax" dica="sem teto" params={params} rotulo="Máximo" onCommit={setSingle}/>
      </div>
      {/* Orçamento fechado é comum em obra grande: filtrar por faixa sem esta
          ressalva eliminaria justamente o alvo. Por isso vem marcado. */}
      <label className="bx-check" style={{ marginTop: 9 }}>
        <input checked={params.get("sig") !== "0"} onChange={(event) => setSingle("sig", event.target.checked ? "" : "0")} type="checkbox"/>
        <span className="txt"><b>Incluir valor sigiloso</b><span>Orçamento fechado é comum em obra grande.</span></span>
      </label>
    </div>

    <div className="bx-secao">
      <h3>Prazo para a proposta</h3>
      <div className="bx-par-campos">
        <Numero chave="dmin" dica="0" params={params} rotulo="Mín. de dias" onCommit={setSingle}/>
        <Numero chave="dmax" dica="sem teto" params={params} rotulo="Máx. de dias" onCommit={setSingle}/>
      </div>
    </div>

    {groups.map((group) => {
      const marked = selected(group.key);
      return <div className="bx-secao" key={group.key}>
        <h3>{group.label}</h3>
        <div className="bx-pilulas">
          {group.options.map((option) => {
            const on = marked.includes(option.value);
            return <button
              aria-pressed={on}
              className="bx-pil"
              disabled={option.count === 0 && !on}
              key={option.value}
              onClick={() => toggle(group.key, option.value)}
              type="button"
            >
              {option.label}<span className="n">{option.count}</span>
            </button>;
          })}
        </div>
      </div>;
    })}

    <div className="bx-secao">
      <h3>Ordenar</h3>
      <select
        className="bx-sel"
        onChange={(event) => setSingle("sort", event.target.value)}
        value={params.get("sort") ?? sortOptions[0]?.value}
      >
        {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  </aside>;
}

/**
 * Campo numérico da sidebar. Grava ao sair do campo ou no Enter, não a cada
 * tecla: a fila recarregaria a cada dígito.
 */
function Numero({ chave, dica, params, rotulo, onCommit }: {
  chave: string; dica: string; rotulo: string;
  params: URLSearchParams; onCommit: (chave: string, valor: string) => void;
}) {
  const [valor, setValor] = useState(params.get(chave) ?? "");
  const gravar = () => { const limpo = valor.replace(/\D/g, ""); if (limpo !== (params.get(chave) ?? "")) onCommit(chave, limpo); };

  return <label className="bx-mini">
    <span>{rotulo}</span>
    <input
      inputMode="numeric"
      onBlur={gravar}
      onChange={(event) => setValor(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); gravar(); } }}
      placeholder={dica}
      value={valor}
    />
  </label>;
}

/**
 * Barra de aderência mínima. O valor local existe só para o número acompanhar o
 * arrasto; a consulta sai quando a mão para, senão a fila recarregaria dezenas
 * de vezes num gesto só.
 *
 * Quem monta passa `key={floor}`: quando a barra de endereço muda — voltar,
 * avançar, limpar tudo — o componente é remontado e nasce já com o valor certo,
 * sem sincronizar estado dentro de efeito.
 */
function AdherenceRange({ floor, onCommit }: { floor: number; onCommit: (value: number) => void }) {
  const [value, setValue] = useState(floor);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function slide(next: number) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(next), 320);
  }

  return <div className="bx-faixa">
    <input aria-label="Aderência mínima" max={100} min={0} onChange={(event) => slide(Number(event.target.value))} step={5} type="range" value={value}/>
    <span className="pc">{value}%</span>
  </div>;
}
