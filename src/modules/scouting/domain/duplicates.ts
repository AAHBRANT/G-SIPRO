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
 * As duas pistas que identificam a MESMA licitação dentro de um órgão —
 * calculadas juntas, nunca uma escolhida em vez da outra.
 *
 * ⚠️ Fazer "processo OU objeto" por item (a versão anterior) tinha o mesmo
 * defeito que o documento do órgão já tinha tido: quando uma das duas
 * capturas vem com número de processo e a outra não (o campo nem sempre
 * volta preenchido do PNCP), cada uma virava uma chave de tipo diferente e as
 * duas nunca se encontravam — mesmo sendo, das duas vezes, o mesmo objeto,
 * mesmo valor, mesmo prazo. Calcular as duas pistas sempre, e UNIR quem bate
 * em qualquer uma delas, é o que faz a licitação com processo encontrar sua
 * gêmea sem processo através do objeto em comum.
 */
function pistas(item: DuplicateInput): { processo?: string; objeto?: string } {
  const processo = somenteDigitos(item.processNumber ?? "");
  // Objeto curto demais não distingue nada: "reforma de escola" se repete em
  // municípios diferentes e agruparia obras que nada têm a ver.
  const objeto = normalizeText(item.subject).replace(/\s+/g, " ").trim();
  return {
    ...(processo.length >= 6 ? { processo } : {}),
    ...(objeto.length >= 40 ? { objeto: objeto.slice(0, 120) } : {}),
  };
}

/**
 * União por índice (dentro de um grupo já resolvido como "mesmo órgão").
 * Compacto de propósito: o maior grupo real observado tem poucas dezenas de
 * avisos, então path compression simples já basta — não há necessidade de
 * union by rank aqui.
 */
function uniao(tamanho: number) {
  const pai = Array.from({ length: tamanho }, (_, i) => i);
  function achar(i: number): number {
    while (pai[i] !== i) { pai[i] = pai[pai[i]!]!; i = pai[i]!; }
    return i;
  }
  function unir(a: number, b: number) {
    const ra = achar(a);
    const rb = achar(b);
    if (ra !== rb) pai[ra] = rb;
  }
  return { achar, unir };
}

/** Agrupa por uma pista dentro do subgrupo, unindo todo mundo que compartilha o mesmo valor. */
function unirPelaPista(
  subgrupo: readonly DuplicateInput[],
  pistaDe: (item: DuplicateInput) => string | undefined,
  unir: (a: number, b: number) => void,
) {
  const primeiraOcorrencia = new Map<string, number>();
  subgrupo.forEach((item, indice) => {
    const valor = pistaDe(item);
    if (!valor) return;
    const anterior = primeiraOcorrencia.get(valor);
    if (anterior === undefined) primeiraOcorrencia.set(valor, indice);
    else unir(indice, anterior);
  });
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
  // existem). Fazer o contrário — escolher "documento OU nome" por item —
  // quebrava o caso comum: a mesma licitação captada em duas varreduras, uma
  // com o documento vindo do PNCP e outra sem, nunca batia (achado em
  // produção: Santa Lúcia/PR, Concorrência Eletrônica municipal).
  const porNome = new Map<string, DuplicateInput[]>();
  for (const item of items) {
    const nome = normalizeText(item.authorityName);
    if (!nome) continue;
    const grupo = porNome.get(nome);
    if (grupo) grupo.push(item);
    else porNome.set(nome, [item]);
  }

  const resultado = new Map<string, string[]>();
  const registrarGrupo = (ids: readonly string[]) => {
    if (ids.length < 2) return;
    for (const id of ids) resultado.set(id, ids.filter((outro) => outro !== id));
  };

  const processarSubgrupo = (subgrupo: readonly DuplicateInput[]) => {
    if (subgrupo.length < 2) return;
    const { achar, unir } = uniao(subgrupo.length);
    unirPelaPista(subgrupo, (item) => pistas(item).processo, unir);
    unirPelaPista(subgrupo, (item) => pistas(item).objeto, unir);

    const grupos = new Map<number, string[]>();
    subgrupo.forEach((item, indice) => {
      const raiz = achar(indice);
      const atual = grupos.get(raiz);
      if (atual) atual.push(item.id);
      else grupos.set(raiz, [item.id]);
    });
    for (const ids of grupos.values()) registrarGrupo(ids);
  };

  for (const grupo of porNome.values()) {
    const documentos = [...new Set(
      grupo.map((item) => somenteDigitos(item.authorityDocument ?? "")).filter((doc) => doc.length > 0),
    )];

    if (documentos.length <= 1) {
      // Nenhum documento informado, ou só um valor em todo o grupo: mesmo
      // nome já basta para tratar como o mesmo órgão, com ou sem o campo
      // preenchido em cada aviso individualmente.
      processarSubgrupo(grupo);
      continue;
    }

    // Documentos DIFERENTES de verdade sob o mesmo nome: são órgãos distintos
    // que coincidem no texto (dois municípios homônimos, por exemplo). Cada
    // documento forma seu próprio subgrupo; quem não informou documento aqui
    // fica de fora — não dá para saber a qual dos órgãos conflitantes
    // pertence, e juntar errado é pior do que não juntar.
    for (const documento of documentos) {
      processarSubgrupo(grupo.filter((item) => somenteDigitos(item.authorityDocument ?? "") === documento));
    }
  }

  return resultado;
}

export type DuplicateResolutionInput = DuplicateInput & Readonly<{
  /** Quando o órgão publicou, se o PNCP informar. */
  publishedAt?: Date | undefined;
  /** Reserva: usada só quando nenhuma das duas tem `publishedAt`. */
  createdAt: Date;
}>;

/**
 * Decide, dentro de cada grupo de duplicatas, quem fica na fila.
 *
 * A publicação mais recente vence — republicação costuma ser retificação
 * (prazo, valor ou exigência atualizados), então é a versão mais nova que a
 * equipe deve ver. Sem data de publicação em nenhuma das duas, a mais
 * recentemente CAPTADA por esta casa serve de aproximação.
 *
 * Devolve, para cada perdedor, o id de quem sobreviveu — nunca os dois lados
 * de um mesmo par: cada licitação aparece no máximo uma vez, como perdedora
 * de um único grupo.
 */
export function resolveDuplicates(items: readonly DuplicateResolutionInput[]): ReadonlyMap<string, string> {
  const grupos = findDuplicates(items);
  const porId = new Map(items.map((item) => [item.id, item]));
  const referencia = (item: DuplicateResolutionInput) => item.publishedAt ?? item.createdAt;

  const resultado = new Map<string, string>();
  const processados = new Set<string>();

  for (const [id, outros] of grupos) {
    if (processados.has(id)) continue;
    const membros = [id, ...outros];
    for (const membro of membros) processados.add(membro);

    const sobrevivente = membros.reduce((melhor, candidato) => {
      const dataMelhor = referencia(porId.get(melhor)!);
      const dataCandidato = referencia(porId.get(candidato)!);
      return dataCandidato > dataMelhor ? candidato : melhor;
    });

    for (const membro of membros) {
      if (membro !== sobrevivente) resultado.set(membro, sobrevivente);
    }
  }

  return resultado;
}
