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

export type ArchiveRequirement = Readonly<{
  /**
   * Textos de onde as categorias de serviço são reconhecidas.
   *
   * Enquanto o edital não é lido, é o objeto da licitação — uma fonte só.
   * Depois da leitura, é a lista de parcelas de maior relevância, cada uma um
   * texto. O confronto não muda: a régua é a mesma nos dois casos.
   */
  sources: readonly string[];
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
  contractValue?: number;
  contractSubject?: string;
}>;

export type CoverageItem = Readonly<{
  categoryId: string;
  label: string;
  covered: boolean;
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
  needsPartner: boolean;
  scale: ScaleVerdict;
  largestExecuted?: number;
  reasons: readonly string[];
}>;

const dinheiro = (value: number) =>
  `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;

/** Categorias que cada serviço do acervo comprova, com o serviço que as sustenta. */
function indexarAcervo(archive: readonly ArchiveEvidence[]): Map<string, ArchiveEvidence[]> {
  const indice = new Map<string, ArchiveEvidence[]>();
  for (const evidence of archive) {
    // Disciplina, descrição e características juntas: a nomenclatura de atestado
    // varia, e o que falta num campo costuma estar no outro.
    const texto = `${evidence.discipline} ${evidence.description} ${evidence.characteristics}`;
    for (const categoria of categoriesIn(texto)) {
      const atual = indice.get(categoria.id);
      if (atual) atual.push(evidence);
      else indice.set(categoria.id, [evidence]);
    }
  }
  return indice;
}

const naoJulgado = (requirement: ArchiveRequirement, motivo: string): ArchiveAdherence => ({
  score: 0,
  determined: false,
  requirementInferred: requirement.inferred,
  required: [],
  missing: [],
  needsPartner: false,
  scale: "UNKNOWN",
  reasons: [motivo],
});

/**
 * Confronta o que o objeto exige com o que a empresa comprovou executar.
 *
 * A cobertura de serviços pesa 80 e o porte 20: consórcio resolve porte com
 * frequência, enquanto falta de acervo do serviço inabilita direto.
 */
export function computeArchiveAdherence(
  requirement: ArchiveRequirement,
  archive: readonly ArchiveEvidence[],
): ArchiveAdherence {
  // União das categorias de todas as fontes, sem repetir: duas parcelas do
  // mesmo ramo não valem por duas exigências.
  const exigidas = [...new Map(
    requirement.sources.flatMap((fonte) => categoriesIn(fonte)).map((c) => [c.id, c]),
  ).values()];

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

  const required: CoverageItem[] = exigidas.map((categoria: ServiceCategory) => {
    const evidencias = indice.get(categoria.id) ?? [];
    return {
      categoryId: categoria.id,
      label: categoria.label,
      covered: evidencias.length > 0,
      evidenceCount: evidencias.length,
      examples: evidencias.slice(0, 3).map((e) => e.description.trim().slice(0, 120)),
    };
  });

  const missing = required.filter((item) => !item.covered);
  const cobertura = (required.length - missing.length) / required.length;

  // Porte: o maior contrato entre os serviços que sustentam as categorias
  // cobertas. Contrato alheio ao objeto não comprova capacidade para este.
  const valores = required
    .filter((item) => item.covered)
    .flatMap((item) => (indice.get(item.categoryId) ?? []).map((e) => e.contractValue))
    .filter((valor): valor is number => valor !== undefined);
  const largestExecuted = valores.length > 0 ? Math.max(...valores) : undefined;

  let scale: ScaleVerdict = "UNKNOWN";
  let notaPorte = 0;
  if (requirement.estimatedValue !== undefined && largestExecuted !== undefined) {
    if (largestExecuted >= requirement.estimatedValue) { scale = "COVERED"; notaPorte = 1; }
    else { scale = "BELOW"; notaPorte = Math.max(0, Math.min(1, largestExecuted / requirement.estimatedValue)); }
  }

  // Sem comparação de porte a nota para nos 80 pontos da cobertura. Cem por
  // cento tem de significar "todo serviço comprovado E porte coberto".
  const score = Math.round(cobertura * 80 + notaPorte * 20);

  const reasons: string[] = [];
  const cobertas = required.filter((item) => item.covered);
  if (cobertas.length > 0) {
    reasons.push(`acervo comprova ${cobertas.length} de ${required.length}: ${cobertas.map((c) => c.label.toLowerCase()).join(", ")}`);
  }
  if (missing.length > 0) reasons.push(`falta acervo de ${missing.map((m) => m.label.toLowerCase()).join(", ")}`);
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
    // O sinal que decide parceria: falta serviço, ou o porte executado não
    // chega perto do da obra.
    needsPartner: missing.length > 0 || scale === "BELOW",
    scale,
    ...(largestExecuted !== undefined ? { largestExecuted } : {}),
    reasons,
  };
}
