import { normalizeText, workTypeTerms } from "@/modules/scouting/domain/qualification";
import type { ScoutWorkType } from "@/modules/scouting/domain/scout-filter";

/**
 * Aderência do ACERVO: a empresa já executou obra deste tipo, e deste porte?
 *
 * É pergunta diferente da aderência ao perfil. Perfil responde "isto cabe no
 * que a gente decidiu disputar" — uma lista configurada. Acervo responde "a
 * gente tem prova de já ter feito" — o que está no acervo técnico. É o acervo
 * que inabilita numa licitação; o perfil só filtra.
 *
 * ⚠️ LIMITE CONHECIDO. O que o edital exige como parcela de maior relevância só
 * existe no PDF do edital, que o sistema ainda não lê. Enquanto isso, o
 * requisito é INFERIDO do objeto da licitação e do valor estimado. Por isso
 * toda leitura sai marcada como estimada, e a tela precisa dizer isso. Quando a
 * leitura do edital entrar, troca-se a origem do requisito e o confronto
 * continua igual — é essa a razão de `ArchiveRequirement` ser um tipo à parte.
 */

/** O que se exige da empresa. Hoje inferido do objeto; amanhã lido do edital. */
export type ArchiveRequirement = Readonly<{
  workTypes: readonly ScoutWorkType[];
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
  /** Valor do contrato de onde veio o serviço, quando registrado. */
  contractValue?: number;
  contractSubject?: string;
}>;

/**
 * Quanta confiança a correspondência merece. A distinção existe porque
 * apresentar palpite como certeza faz alguém gastar proposta e ser inabilitado
 * na entrega do envelope.
 */
export const matchCertainties = ["IDENTICAL", "LIKELY", "NONE"] as const;
export type MatchCertainty = (typeof matchCertainties)[number];

export type WorkTypeMatch = Readonly<{
  workType: ScoutWorkType;
  certainty: MatchCertainty;
  /** Serviços do acervo que sustentam a correspondência. */
  evidence: readonly ArchiveEvidence[];
  /** Maior contrato entre as evidências, quando há valor registrado. */
  largestContractValue?: number;
}>;

export type ScaleVerdict = "COVERED" | "BELOW" | "UNKNOWN";

export type ArchiveAdherence = Readonly<{
  /** 0 a 100. Só significa alguma coisa quando `determined` é verdadeiro. */
  score: number;
  /** Falso quando não há acervo cadastrado que permita julgar. */
  determined: boolean;
  /** Verdadeiro enquanto o requisito for inferido do objeto. */
  requirementInferred: boolean;
  matches: readonly WorkTypeMatch[];
  scale: ScaleVerdict;
  /** Maior obra já executada entre as que casaram, para comparar de porte. */
  largestExecuted?: number;
  reasons: readonly string[];
}>;

/** Nome do ramo em português: a razão vai para a tela, não para o log. */
const rotuloDoTipo: Readonly<Record<ScoutWorkType, string>> = {
  BUILDING: "edificação",
  SPECIAL_STRUCTURE: "obra de arte especial",
  PAVING: "pavimentação",
  URBAN_INFRASTRUCTURE: "infraestrutura urbana",
  SANITATION: "saneamento",
  EARTHWORKS: "contenção e terraplenagem",
  RENOVATION: "reforma",
};

const dinheiro = (value: number) =>
  `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;

/**
 * Reconhece o tipo de obra dentro de um serviço do acervo.
 *
 * A disciplina vale mais que a descrição: "Pavimentação" no campo de disciplina
 * é declaração; a mesma palavra perdida no meio de uma descrição pode ser
 * menção de passagem. Por isso o resultado carrega o grau de certeza em vez de
 * um sim ou não.
 */
export function certaintyFor(evidence: ArchiveEvidence, workType: ScoutWorkType): MatchCertainty {
  const termos = workTypeTerms[workType];
  const disciplina = normalizeText(evidence.discipline);
  if (termos.some((termo) => disciplina.includes(termo))) return "IDENTICAL";

  // O objeto do CONTRATO fica de fora de propósito. Incluí-lo faria um serviço
  // de drenagem executado dentro de um contrato de rodovia contar como acervo
  // de pavimentação — e parcela de maior relevância se prova pelo serviço, não
  // pelo contrato que o abrigou.
  const resto = normalizeText(`${evidence.description} ${evidence.characteristics}`);
  return termos.some((termo) => resto.includes(termo)) ? "LIKELY" : "NONE";
}

const pesoDaCerteza: Readonly<Record<MatchCertainty, number>> = { IDENTICAL: 1, LIKELY: 0.6, NONE: 0 };

/**
 * Confronta o que se exige com o que a empresa executou.
 *
 * A nota pesa o tipo de obra em 70 e o porte em 30: executar o tipo certo é
 * pré-requisito, e porte insuficiente costuma ser contornável por consórcio —
 * o inverso não é verdade.
 */
export function computeArchiveAdherence(
  requirement: ArchiveRequirement,
  archive: readonly ArchiveEvidence[],
): ArchiveAdherence {
  const reasons: string[] = [];

  if (requirement.workTypes.length === 0) {
    return {
      score: 0, determined: false, requirementInferred: requirement.inferred, matches: [], scale: "UNKNOWN",
      reasons: ["tipo de obra não reconhecido no objeto"],
    };
  }

  if (archive.length === 0) {
    // Acervo vazio não é acervo insuficiente. Dizer 0% aqui faria a equipe
    // descartar obra que ela sabe fazer, só porque ninguém cadastrou a CAT.
    return {
      score: 0, determined: false, requirementInferred: requirement.inferred, matches: [], scale: "UNKNOWN",
      reasons: ["nenhum acervo cadastrado para confrontar"],
    };
  }

  const matches: WorkTypeMatch[] = requirement.workTypes.map((workType) => {
    const avaliadas = archive
      .map((evidence) => ({ evidence, certainty: certaintyFor(evidence, workType) }))
      .filter((item) => item.certainty !== "NONE");

    const melhor: MatchCertainty = avaliadas.some((item) => item.certainty === "IDENTICAL") ? "IDENTICAL"
      : avaliadas.length > 0 ? "LIKELY" : "NONE";

    const valores = avaliadas.map((item) => item.evidence.contractValue).filter((v): v is number => v !== undefined);

    return {
      workType,
      certainty: melhor,
      evidence: avaliadas.map((item) => item.evidence),
      ...(valores.length > 0 ? { largestContractValue: Math.max(...valores) } : {}),
    };
  });

  const notaTipo = matches.reduce((total, m) => total + pesoDaCerteza[m.certainty], 0) / matches.length;

  const maiores = matches.map((m) => m.largestContractValue).filter((v): v is number => v !== undefined);
  const largestExecuted = maiores.length > 0 ? Math.max(...maiores) : undefined;

  let scale: ScaleVerdict = "UNKNOWN";
  let notaPorte = 0;
  if (requirement.estimatedValue === undefined || largestExecuted === undefined) {
    // Sem um dos dois lados não há comparação. O critério sai da conta em vez
    // de virar zero — zerar aqui puniria a licitação de orçamento sigiloso.
    scale = "UNKNOWN";
  } else if (largestExecuted >= requirement.estimatedValue) {
    scale = "COVERED";
    notaPorte = 1;
  } else {
    scale = "BELOW";
    // Porte parcial conta proporcionalmente: já ter feito metade do tamanho é
    // muito diferente de nunca ter chegado perto.
    notaPorte = Math.max(0, Math.min(1, largestExecuted / requirement.estimatedValue));
  }

  const score = scale === "UNKNOWN"
    ? Math.round(notaTipo * 100)
    : Math.round((notaTipo * 70 + notaPorte * 30) / 100 * 100);

  for (const m of matches) {
    const rot = rotuloDoTipo[m.workType];
    if (m.certainty === "IDENTICAL") reasons.push(`acervo comprova ${rot} (${m.evidence.length} serviço${m.evidence.length > 1 ? "s" : ""})`);
    else if (m.certainty === "LIKELY") reasons.push(`acervo sugere ${rot}, mas a disciplina não bate — conferir`);
    else reasons.push(`sem acervo de ${rot}`);
  }
  if (scale === "COVERED" && largestExecuted !== undefined) reasons.push(`já executou obra de ${dinheiro(largestExecuted)}`);
  if (scale === "BELOW" && largestExecuted !== undefined && requirement.estimatedValue !== undefined) {
    reasons.push(`maior obra executada foi ${dinheiro(largestExecuted)}, contra ${dinheiro(requirement.estimatedValue)} desta`);
  }
  if (scale === "UNKNOWN") reasons.push("porte não comparável");

  return {
    score,
    determined: true,
    requirementInferred: requirement.inferred,
    matches,
    scale,
    ...(largestExecuted !== undefined ? { largestExecuted } : {}),
    reasons,
  };
}
