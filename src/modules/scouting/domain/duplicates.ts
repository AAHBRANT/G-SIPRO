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
 * Chave DENTRO de um grupo já resolvido como "mesmo órgão" — `discriminador`
 * é só para não colidir com a chave de outro grupo, o agrupamento em si já
 * aconteceu antes desta função ser chamada.
 *
 * O número do processo administrativo é o identificador que o órgão mantém
 * entre republicações — quando ele existe, manda. Sem ele, o objeto normalizado
 * e cortado serve de aproximação: objeto longo repetido palavra por palavra
 * entre dois avisos do mesmo órgão é republicação com alta probabilidade.
 */
function chaveNoOrgao(item: DuplicateInput, discriminador: string): string | undefined {
  const processo = somenteDigitos(item.processNumber ?? "");
  if (processo.length >= 6) return `p:${discriminador}:${processo}`;

  // Objeto curto demais não distingue nada: "reforma de escola" se repete em
  // municípios diferentes e agruparia obras que nada têm a ver.
  const objeto = normalizeText(item.subject).replace(/\s+/g, " ").trim();
  return objeto.length >= 40 ? `o:${discriminador}:${objeto.slice(0, 120)}` : undefined;
}

export type DuplicateGroups = ReadonlyMap<string, readonly string[]>;

/**
 * Devolve, para cada licitação que tem par, os ids das OUTRAS do mesmo grupo.
 * Quem não tem par não aparece no mapa.
 */
export function findDuplicates(items: readonly DuplicateInput[]): DuplicateGroups {
  // Primeiro agrupa por NOME do órgão — sempre presente, ao contrário do
  // documento. O documento é usado só para SEPARAR, dentro de um mesmo nome,
  // órgãos que de fato são diferentes (raro, mas dois municípios homônimos
  // existem). Fazer o contrário — como a versão anterior fazia, escolhendo
  // "documento OU nome" por item — quebrava o caso comum: a mesma licitação
  // captada em duas varreduras, uma com o documento vindo do PNCP e outra sem
  // (o campo nem sempre volta preenchido), nunca batia, porque uma virava
  // chave de dígitos e a outra de texto — duas licitações idênticas (mesmo
  // objeto, valor, prazo) ficavam sem o aviso de "possível republicação"
  // (achado em produção: Santa Lúcia/PR, Concorrência Eletrônica municipal).
  const porNome = new Map<string, DuplicateInput[]>();
  for (const item of items) {
    const nome = normalizeText(item.authorityName);
    if (!nome) continue;
    const grupo = porNome.get(nome);
    if (grupo) grupo.push(item);
    else porNome.set(nome, [item]);
  }

  const porChave = new Map<string, string[]>();
  const registrar = (chave: string | undefined, id: string) => {
    if (!chave) return;
    const atual = porChave.get(chave);
    if (atual) atual.push(id);
    else porChave.set(chave, [id]);
  };

  for (const [nome, grupo] of porNome) {
    const documentos = [...new Set(
      grupo.map((item) => somenteDigitos(item.authorityDocument ?? "")).filter((doc) => doc.length > 0),
    )];

    if (documentos.length <= 1) {
      // Nenhum documento informado, ou só um valor em todo o grupo: mesmo
      // nome já basta para tratar como o mesmo órgão, com ou sem o campo
      // preenchido em cada aviso individualmente.
      for (const item of grupo) registrar(chaveNoOrgao(item, `n:${nome}`), item.id);
      continue;
    }

    // Documentos DIFERENTES de verdade sob o mesmo nome: são órgãos distintos
    // que coincidem no texto (dois municípios homônimos, por exemplo). Cada
    // documento forma seu próprio subgrupo; quem não informou documento aqui
    // fica de fora — não dá para saber a qual dos órgãos conflitantes
    // pertence, e juntar errado é pior do que não juntar.
    for (const documento of documentos) {
      const subgrupo = grupo.filter((item) => somenteDigitos(item.authorityDocument ?? "") === documento);
      for (const item of subgrupo) registrar(chaveNoOrgao(item, `d:${documento}`), item.id);
    }
  }

  const resultado = new Map<string, readonly string[]>();
  for (const ids of porChave.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) resultado.set(id, ids.filter((outro) => outro !== id));
  }
  return resultado;
}
