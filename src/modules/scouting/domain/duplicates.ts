import { normalizeText } from "@/modules/scouting/domain/qualification";

/**
 * Licitações que parecem ser a mesma obra publicada mais de uma vez.
 *
 * O `numeroControlePNCP` é único no banco, então linha repetida não existe. O
 * que existe é a MESMA obra com números de controle diferentes: o órgão
 * republica depois de uma retificação, ou publica o mesmo processo em outra
 * modalidade, e o PNCP devolve as duas.
 *
 * ⚠️ Isto SINALIZA, nunca esconde. Esconder a errada faz a equipe perder uma
 * obra sem nunca saber que ela existiu — e o custo de ver duas linhas parecidas
 * é olhar duas linhas parecidas. A decisão de ignorar uma delas é de quem lê.
 */

export type DuplicateInput = Readonly<{
  id: string;
  authorityDocument?: string | undefined;
  authorityName: string;
  processNumber?: string | undefined;
  subject: string;
}>;

/** Só dígitos: "2026-16974-0" e "2026/16974/0" são o mesmo processo. */
const somenteDigitos = (texto: string) => texto.replace(/\D/g, "");

/**
 * Chave de agrupamento.
 *
 * O número do processo administrativo é o identificador que o órgão mantém
 * entre republicações — quando ele existe, manda. Sem ele, o objeto normalizado
 * e cortado serve de aproximação: objeto longo repetido palavra por palavra
 * entre dois avisos do mesmo órgão é republicação com alta probabilidade.
 */
function chave(item: DuplicateInput): string | undefined {
  const orgao = somenteDigitos(item.authorityDocument ?? "") || normalizeText(item.authorityName);
  if (!orgao) return undefined;

  const processo = somenteDigitos(item.processNumber ?? "");
  if (processo.length >= 6) return `p:${orgao}:${processo}`;

  // Objeto curto demais não distingue nada: "reforma de escola" se repete em
  // municípios diferentes e agruparia obras que nada têm a ver.
  const objeto = normalizeText(item.subject).replace(/\s+/g, " ").trim();
  return objeto.length >= 40 ? `o:${orgao}:${objeto.slice(0, 120)}` : undefined;
}

export type DuplicateGroups = ReadonlyMap<string, readonly string[]>;

/**
 * Devolve, para cada licitação que tem par, os ids das OUTRAS do mesmo grupo.
 * Quem não tem par não aparece no mapa.
 */
export function findDuplicates(items: readonly DuplicateInput[]): DuplicateGroups {
  const porChave = new Map<string, string[]>();
  for (const item of items) {
    const k = chave(item);
    if (!k) continue;
    const atual = porChave.get(k);
    if (atual) atual.push(item.id);
    else porChave.set(k, [item.id]);
  }

  const resultado = new Map<string, readonly string[]>();
  for (const ids of porChave.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) resultado.set(id, ids.filter((outro) => outro !== id));
  }
  return resultado;
}
