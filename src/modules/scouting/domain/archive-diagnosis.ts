/**
 * Diagnóstico do encontro entre o catálogo de serviços e o acervo real.
 *
 * A pergunta que ele responde é uma só: **o sistema entende o vocabulário dos
 * nossos atestados?** Enquanto ela não for respondida com dado real, a nota de
 * acervo é um palpite bem-intencionado — o catálogo foi escrito olhando editais,
 * não os atestados da casa.
 *
 * Vive aqui, e não dentro de um script, porque a resposta muda toda vez que o
 * acervo cresce. Quem precisa dela abre a tela; ninguém precisa de credencial
 * de banco na mão para saber se a triagem está enxergando direito.
 */
import {
  computeArchiveAdherence,
  type ArchiveAdherence,
  type ArchiveEvidence,
} from "@/modules/scouting/domain/archive-adherence";
import { categoriesIn, serviceCatalog } from "@/modules/scouting/domain/service-catalog";

const textoDe = (evidence: ArchiveEvidence) =>
  `${evidence.discipline} ${evidence.description} ${evidence.characteristics}`;

const contar = <T>(itens: readonly T[], chave: (item: T) => string) => {
  const mapa = new Map<string, number>();
  for (const item of itens) {
    const k = chave(item);
    mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  return [...mapa].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
};

export type ArchiveDiagnosis = Readonly<{
  services: number;
  withContractValue: number;
  /** Quantos serviços do acervo sustentam cada categoria do catálogo. */
  coverage: readonly { label: string; count: number }[];
  /** Serviços que não casaram com categoria nenhuma — o acervo invisível. */
  orphans: number;
  orphanDisciplines: readonly { label: string; count: number }[];
  /**
   * Categorias que juntam disciplinas diferentes.
   *
   * É a lista que denuncia o catálogo grosso demais: se "Túneis" e "Pontes"
   * aparecem sob a mesma categoria, um atestado de ponte passa a cobrir uma
   * exigência de túnel. Separar é decisão de quem conhece a obra.
   */
  conflations: readonly { category: string; disciplines: readonly string[] }[];
}>;

export function diagnoseArchive(archive: readonly ArchiveEvidence[]): ArchiveDiagnosis {
  const coverage = serviceCatalog
    .map((categoria) => ({
      label: categoria.label,
      count: archive.filter((e) => categoriesIn(textoDe(e)).some((x) => x.id === categoria.id)).length,
    }))
    .sort((a, b) => b.count - a.count);

  const orfaos = archive.filter((e) => categoriesIn(textoDe(e)).length === 0);

  const porCategoria = new Map<string, Set<string>>();
  for (const e of archive) {
    for (const c of categoriesIn(textoDe(e))) {
      const atual = porCategoria.get(c.label) ?? new Set<string>();
      atual.add(e.discipline.trim() || "(sem disciplina)");
      porCategoria.set(c.label, atual);
    }
  }

  return {
    services: archive.length,
    withContractValue: archive.filter((e) => e.contractValue !== undefined).length,
    coverage,
    orphans: orfaos.length,
    orphanDisciplines: contar(orfaos, (e) => e.discipline.trim() || "(sem disciplina)"),
    conflations: [...porCategoria]
      .filter(([, disciplinas]) => disciplinas.size > 1)
      .map(([category, disciplinas]) => ({ category, disciplines: [...disciplinas].sort() }))
      .sort((a, b) => b.disciplines.length - a.disciplines.length),
  };
}

export type QueueDiagnosis = Readonly<{
  total: number;
  judged: number;
  needsPartner: number;
  unjudged: readonly { label: string; count: number }[];
  /** Distribuição das notas, para ver se a régua separa alguma coisa. */
  bands: readonly { label: string; count: number }[];
  /** O que mais falta no acervo — a pauta de parceria. */
  missing: readonly { label: string; count: number }[];
  /** Parcelas exigidas que o catálogo não soube classificar. */
  unreadable: readonly { label: string; count: number }[];
}>;

const faixas: ReadonlyArray<{ label: string; dentro: (n: number) => boolean }> = [
  { label: "90 a 100", dentro: (n) => n >= 90 },
  { label: "70 a 89", dentro: (n) => n >= 70 && n < 90 },
  { label: "50 a 69", dentro: (n) => n >= 50 && n < 70 },
  { label: "25 a 49", dentro: (n) => n >= 25 && n < 50 },
  { label: "1 a 24", dentro: (n) => n >= 1 && n < 25 },
  { label: "0", dentro: (n) => n === 0 },
];

export type QueueItem = Readonly<{ subject: string; estimatedValue?: number }>;

/**
 * Roda a mesma aderência que a fila mostra, sobre a fila inteira.
 *
 * ⚠️ Aqui a exigência é DEDUZIDA do objeto, como na tela quando o edital ainda
 * não foi lido. Serve para medir a régua, não para decidir licitação.
 */
export function diagnoseQueue(
  queue: readonly QueueItem[],
  archive: readonly ArchiveEvidence[],
): QueueDiagnosis {
  const avaliadas: ArchiveAdherence[] = queue.map((item) =>
    computeArchiveAdherence(
      {
        sources: [{ text: item.subject }],
        ...(item.estimatedValue !== undefined ? { estimatedValue: item.estimatedValue } : {}),
        inferred: true,
      },
      archive,
    ));

  const julgadas = avaliadas.filter((a) => a.determined);

  return {
    total: avaliadas.length,
    judged: julgadas.length,
    needsPartner: julgadas.filter((a) => a.needsPartner).length,
    unjudged: contar(avaliadas.filter((a) => !a.determined).flatMap((a) => a.reasons), (r) => r),
    bands: faixas.map((faixa) => ({
      label: faixa.label,
      count: julgadas.filter((a) => faixa.dentro(a.score)).length,
    })),
    missing: contar(julgadas.flatMap((a) => a.missing), (m) => m.label),
    unreadable: contar(avaliadas.flatMap((a) => a.unreadable), (t) => t),
  };
}
