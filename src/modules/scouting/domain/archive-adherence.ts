import { compareQuantity, parseQuantity, type Quantity, type QuantityComparison } from "@/modules/scouting/domain/quantity";
import { categoriesIn, type ServiceCategory } from "@/modules/scouting/domain/service-catalog";

/**
 * Aderência do ACERVO: dos serviços que este objeto exige, quantos a empresa já
 * comprovou ter executado — e quais faltam.
 *
 * É pergunta diferente da aderência ao perfil. Perfil responde "isto cabe no que
 * a gente decidiu disputar", uma lista configurada. Acervo responde "a gente tem
 * prova de já ter feito". É o acervo que inabilita; o perfil só filtra.
 *
 * O que FALTA é a informação mais útil da tela: é exatamente o que se procura
 * num parceiro de consórcio. Por isso `missing` e `needsPartner` são resultado
 * de primeira classe, e não dedução que alguém faz de cabeça olhando a nota.
 *
 * ⚠️ LIMITE. O que o edital EXIGE como parcela de maior relevância só existe no
 * PDF, que o sistema ainda não lê. Enquanto isso o requisito é inferido do
 * objeto, e toda leitura sai marcada como estimada. `ArchiveRequirement` é um
 * tipo à parte justamente para que a leitura do edital, quando entrar, troque
 * só a origem do requisito — o confronto continua igual.
 */

/**
 * Uma exigência: o texto que a descreve e, quando o edital informa, o
 * quantitativo mínimo. Sem quantitativo a cobertura é só de categoria — que é
 * onde a leitura por objeto para.
 */
export type RequirementSource = Readonly<{
  text: string;
  quantity?: Quantity;
}>;

export type ArchiveRequirement = Readonly<{
  /**
   * Textos de onde as categorias de serviço são reconhecidas.
   *
   * Enquanto o edital não é lido, é o objeto da licitação — uma fonte só.
   * Depois da leitura, é a lista de parcelas de maior relevância, cada uma um
   * texto. O confronto não muda: a régua é a mesma nos dois casos.
   */
  sources: readonly RequirementSource[];
  /** Porte da obra a disputar, quando o órgão revela. */
  estimatedValue?: number;
  /** Falso quando o requisito veio do edital, e não de inferência. */
  inferred: boolean;
}>;

/** Um serviço que a empresa já executou, como o acervo o guarda. */
export type ArchiveEvidence = Readonly<{
  serviceId: string;
  discipline: string;
  description: string;
  characteristics: string;
  /** Quantitativos do serviço, como escritos no atestado: "12,5 km", "300 m²". */
  quantities?: readonly string[];
  contractValue?: number;
  contractSubject?: string;
}>;

export type CoverageItem = Readonly<{
  categoryId: string;
  label: string;
  covered: boolean;
  /**
   * Confronto de quantitativo, quando o edital informou o mínimo E o acervo
   * traz número comparável. Ausente enquanto o requisito vier do objeto.
   */
  quantity?: QuantityComparison;
  /** Quantos serviços do acervo sustentam esta categoria. */
  evidenceCount: number;
  /** Até três exemplos, para conferir se a leitura faz sentido. */
  examples: readonly string[];
}>;

export type ScaleVerdict = "COVERED" | "BELOW" | "UNKNOWN";

export type ArchiveAdherence = Readonly<{
  /** 0 a 100. Só significa alguma coisa quando `determined` é verdadeiro. */
  score: number;
  determined: boolean;
  requirementInferred: boolean;
  /** Todas as categorias que o objeto exige, cobertas ou não. */
  required: readonly CoverageItem[];
  /** As que o acervo não comprova — o que se busca em consórcio. */
  missing: readonly CoverageItem[];
  /**
   * Parcelas exigidas que o catálogo não soube classificar.
   *
   * ⚠️ Não são "cobertas" nem "faltando": são NÃO CONFERIDAS. Antes elas
   * sumiam em silêncio, e "Ponte + Linha de transmissão 138 kV" saía como
   * "2 de 2 comprovado" — a tela afirmava acervo que a empresa não tem.
   * Marcá-las como faltando seria o erro oposto, e mandaria a equipe procurar
   * consórcio para algo que ela talvez execute. Aparecem à parte, para a pessoa
   * decidir olhando.
   */
  unreadable: readonly string[];
  needsPartner: boolean;
  scale: ScaleVerdict;
  largestExecuted?: number;
  reasons: readonly string[];
}>;

const dinheiro = (value: number) =>
  `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;

/**
 * Índice do acervo, guardado por identidade do próprio arranjo.
 *
 * ⚠️ Este cache não é otimização de vaidade: sem ele a fila não abria. A tela
 * carrega até 900 licitações e confronta cada uma contra o acervo INTEIRO, que
 * é o mesmo para todas. Reindexar por licitação custava ~30 s de CPU com o
 * acervo real da casa — o clique no card ficava sem resposta e a pessoa
 * desistia antes da página montar.
 *
 * A chave é a referência do arranjo, não o conteúdo: `loadEvidence()` devolve
 * um arranjo novo a cada requisição e ninguém o modifica depois. Um `WeakMap`
 * solta a entrada junto com o arranjo, então isto não vaza entre requisições.
 */
const indices = new WeakMap<readonly ArchiveEvidence[], Map<string, IndexedEvidence[]>>();

/** Evidência com o quantitativo já lido: a conversão também rodava por licitação. */
type IndexedEvidence = Readonly<{ evidence: ArchiveEvidence; quantities: readonly (Quantity | null)[] }>;

/** Categorias que cada serviço do acervo comprova, com o serviço que as sustenta. */
function indexarAcervo(archive: readonly ArchiveEvidence[]): Map<string, IndexedEvidence[]> {
  const guardado = indices.get(archive);
  if (guardado) return guardado;

  const indice = new Map<string, IndexedEvidence[]>();
  for (const evidence of archive) {
    // Disciplina, descrição e características juntas: a nomenclatura de atestado
    // varia, e o que falta num campo costuma estar no outro.
    const texto = `${evidence.discipline} ${evidence.description} ${evidence.characteristics}`;
    const item: IndexedEvidence = {
      evidence,
      quantities: (evidence.quantities ?? []).map((texto) => parseQuantity(texto)),
    };
    for (const categoria of categoriesIn(texto)) {
      const atual = indice.get(categoria.id);
      if (atual) atual.push(item);
      else indice.set(categoria.id, [item]);
    }
  }

  indices.set(archive, indice);
  return indice;
}

const naoJulgado = (requirement: ArchiveRequirement, motivo: string): ArchiveAdherence => ({
  score: 0,
  determined: false,
  requirementInferred: requirement.inferred,
  required: [],
  missing: [],
  unreadable: [],
  needsPartner: false,
  scale: "UNKNOWN",
  reasons: [motivo],
});

/**
 * Confronta o que o objeto exige com o que a empresa comprovou executar.
 *
 * A nota é a fração dos serviços exigidos que o acervo comprova — nada mais.
 * O porte é apurado à parte: ele decide consórcio, mas não entra no número,
 * porque quase nenhum atestado tem valor de contrato e a nota acabava presa no
 * mesmo teto para a fila inteira.
 */
export function computeArchiveAdherence(
  requirement: ArchiveRequirement,
  archive: readonly ArchiveEvidence[],
): ArchiveAdherence {
  // União das categorias de todas as fontes, sem repetir: duas parcelas do
  // mesmo ramo não valem por duas exigências. O maior quantitativo entre elas
  // manda: exigir 10 km e 3 km do mesmo serviço significa exigir 10 km.
  const porCategoria = new Map<string, { categoria: ServiceCategory; quantity?: Quantity }>();
  const unreadable: string[] = [];
  for (const fonte of requirement.sources) {
    const categorias = categoriesIn(fonte.text);
    // Parcela que o catálogo não conhece não pode evaporar: sem isto, exigir
    // "linha de transmissão" ao lado de "ponte" devolveria cobertura total.
    if (categorias.length === 0) { unreadable.push(fonte.text.trim().slice(0, 160)); continue; }
    for (const categoria of categorias) {
      const atual = porCategoria.get(categoria.id);
      const maior = !atual?.quantity || (fonte.quantity && fonte.quantity.value > atual.quantity.value)
        ? fonte.quantity
        : atual.quantity;
      porCategoria.set(categoria.id, { categoria, ...(maior ? { quantity: maior } : {}) });
    }
  }
  const exigidas = [...porCategoria.values()];

  if (exigidas.length === 0) {
    // Objeto genérico demais para dizer o que exige. Chutar aqui seria pior do
    // que admitir que não deu para ler.
    return naoJulgado(requirement, "objeto não descreve serviços reconhecíveis");
  }
  if (archive.length === 0) {
    // Acervo vazio não é acervo insuficiente. Dizer 0% faria a equipe descartar
    // obra que sabe fazer só porque ninguém importou os atestados.
    return naoJulgado(requirement, "nenhum acervo cadastrado para confrontar");
  }

  const indice = indexarAcervo(archive);

  const required: CoverageItem[] = exigidas.map(({ categoria, quantity }) => {
    const evidencias = indice.get(categoria.id) ?? [];
    // Quantitativo do acervo para este serviço, na ordem em que o atestado
    // escreveu. Serviço sem número entra como nulo e é contado como ignorado,
    // em vez de sumir da conta em silêncio.
    // Já vieram lidos do índice: converter aqui rodava por licitação.
    const doAcervo = evidencias.flatMap((e) => e.quantities);
    const comparacao = quantity ? compareQuantity(quantity, doAcervo) : undefined;

    return {
      categoryId: categoria.id,
      label: categoria.label,
      // Com quantitativo exigido, ter o serviço não basta: o número tem de
      // alcançar. Ponte de 8 m não cobre exigência de 15 m só por ser ponte.
      covered: evidencias.length > 0 && (comparacao === undefined || comparacao.verdict !== "BELOW"),
      evidenceCount: evidencias.length,
      examples: evidencias.slice(0, 3).map((e) => e.evidence.description.trim().slice(0, 120)),
      ...(comparacao ? { quantity: comparacao } : {}),
    };
  });

  const missing = required.filter((item) => !item.covered);
  const cobertura = (required.length - missing.length) / required.length;

  // Porte: o maior contrato entre os serviços que sustentam as categorias
  // cobertas. Contrato alheio ao objeto não comprova capacidade para este.
  const valores = required
    .filter((item) => item.covered)
    .flatMap((item) => (indice.get(item.categoryId) ?? []).map((e) => e.evidence.contractValue))
    .filter((valor): valor is number => valor !== undefined);
  const largestExecuted = valores.length > 0 ? Math.max(...valores) : undefined;

  let scale: ScaleVerdict = "UNKNOWN";
  if (requirement.estimatedValue !== undefined && largestExecuted !== undefined) {
    scale = largestExecuted >= requirement.estimatedValue ? "COVERED" : "BELOW";
  }

  /**
   * A nota é SÓ a cobertura de serviços: dos serviços que a licitação exige,
   * quantos o acervo comprova.
   *
   * ⚠️ O porte ficava valendo 20 dos 100 pontos. Como quase nenhum atestado tem
   * valor de contrato cadastrado, o porte saía "não julgado" em toda licitação
   * e a nota parava em 80 — TODA a fila com o mesmo número, que não separa
   * nada e ainda parece precisão. Misturar "tenho o serviço?" com "a obra cabe
   * no meu porte?" num número só torna os dois ilegíveis.
   *
   * O porte continua sendo apurado e continua decidindo consórcio; ele aparece
   * como frase à parte no cartão, com o motivo de não ter sido julgado quando
   * for o caso.
   */
  const score = Math.round(cobertura * 100);

  const reasons: string[] = [];
  const cobertas = required.filter((item) => item.covered);
  if (cobertas.length > 0) {
    reasons.push(`acervo comprova ${cobertas.length} de ${required.length}: ${cobertas.map((c) => c.label.toLowerCase()).join(", ")}`);
  }
  if (missing.length > 0) reasons.push(`falta acervo de ${missing.map((m) => m.label.toLowerCase()).join(", ")}`);
  if (unreadable.length > 0) {
    reasons.push(`${unreadable.length} parcela(s) que o sistema não soube classificar, e portanto não conferiu: ${unreadable.join("; ")}`);
  }
  // O confronto de número é o que sustenta a habilitação: vai por extenso.
  for (const item of required) {
    if (item.quantity) reasons.push(`${item.label.toLowerCase()}: ${item.quantity.explanation}`);
  }
  if (scale === "COVERED" && largestExecuted !== undefined) reasons.push(`já executou obra de ${dinheiro(largestExecuted)}`);
  if (scale === "BELOW" && largestExecuted !== undefined && requirement.estimatedValue !== undefined) {
    reasons.push(`maior obra executada foi ${dinheiro(largestExecuted)}, contra ${dinheiro(requirement.estimatedValue)} desta`);
  }
  if (scale === "UNKNOWN") {
    reasons.push(requirement.estimatedValue === undefined
      ? "porte não comparável: orçamento sigiloso"
      : "porte não comparável: acervo sem valor de contrato");
  }

  return {
    score,
    determined: true,
    requirementInferred: requirement.inferred,
    required,
    missing,
    unreadable,
    // O sinal que decide parceria: falta serviço, ou o porte executado não
    // chega perto do da obra. Parcela não classificada NÃO entra aqui — não se
    // sabe se falta, e mandar montar consórcio por desconhecimento seria pior.
    needsPartner: missing.length > 0 || scale === "BELOW",
    scale,
    ...(largestExecuted !== undefined ? { largestExecuted } : {}),
    reasons,
  };
}
