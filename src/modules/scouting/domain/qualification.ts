import { scoutConditions, treatmentFor, type ScoutCondition, type ScoutFilter, type ScoutWorkType } from "@/modules/scouting/domain/scout-filter";

/**
 * Licitação como a fonte pública a devolve, antes de qualquer decisão humana.
 * Contém apenas dados cadastrais: a consulta não informa exigências de
 * habilitação, que só existem no edital e no termo de referência.
 */
export type CandidateTender = Readonly<{
  externalId: string;
  subject: string;
  authorityName: string;
  sphere: string;
  state?: string;
  estimatedValue?: number;
  valueUndisclosed: boolean;
  proposalClosesAt?: Date;
}>;

export type QualificationRejection =
  | "SPHERE"
  | "STATE"
  | "EXCLUDED_KEYWORD"
  | "NO_INCLUDED_KEYWORD"
  | "WORK_TYPE"
  | "MINIMUM_VALUE"
  | "MAXIMUM_VALUE"
  | "UNDISCLOSED_VALUE"
  | "DEADLINE";

export type QualificationResult =
  | Readonly<{ qualified: true; workTypes: readonly ScoutWorkType[] }>
  | Readonly<{ qualified: false; reason: QualificationRejection }>;

const workTypeTerms: Readonly<Record<ScoutWorkType, readonly string[]>> = {
  BUILDING: ["edificac", "edifici", "predio", "escola", "creche", "hospital", "posto de saude", "ginasio", "quadra", "sede", "galpao"],
  SPECIAL_STRUCTURE: ["ponte", "viaduto", "passarela", "tunel", "barragem", "acude", "obra de arte especial"],
  PAVING: ["paviment", "rodovia", "estrada", "asfalt", "recapea", "calcament", "duplicac", "terraplen"],
  URBAN_INFRASTRUCTURE: ["urbaniza", "drenagem", "praca", "calcadao", "orla", "iluminac", "requalifica", "revitaliza"],
  SANITATION: ["saneamento", "esgot", "abastecimento de agua", "adutor", "estacao de tratamento", "poco tubular"],
  EARTHWORKS: ["contenc", "muro de arrimo", "talude", "terraplanagem", "movimentacao de terra"],
  RENOVATION: ["reforma", "retrofit", "readequac", "ampliac", "restaurac", "recuperac"],
};

/** Remove acentuação e normaliza espaços para comparação de texto livre. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectWorkTypes(subject: string): readonly ScoutWorkType[] {
  const normalized = normalizeText(subject);
  return (Object.keys(workTypeTerms) as ScoutWorkType[]).filter((workType) =>
    workTypeTerms[workType].some((term) => normalized.includes(term)),
  );
}

export function daysUntil(target: Date, reference: Date): number {
  return Math.floor((target.getTime() - reference.getTime()) / 86_400_000);
}

/**
 * Estágio 1 do funil: confronta os dados cadastrais com o perfil configurado.
 * Responde apenas "esta obra cabe no que a empresa faz e no porte que suporta?".
 * A verificação de habilitação é do Estágio 2, na leitura do edital.
 */
export function qualify(candidate: CandidateTender, filter: ScoutFilter, reference: Date): QualificationResult {
  if (filter.spheres.length > 0 && !filter.spheres.some((sphere) => sphere === candidate.sphere)) {
    return { qualified: false, reason: "SPHERE" };
  }
  if (filter.states.length > 0 && (!candidate.state || !filter.states.includes(candidate.state.toUpperCase()))) {
    return { qualified: false, reason: "STATE" };
  }

  const subject = normalizeText(candidate.subject);
  if (filter.excludeKeywords.some((keyword) => subject.includes(normalizeText(keyword)))) {
    return { qualified: false, reason: "EXCLUDED_KEYWORD" };
  }
  if (filter.includeKeywords.length > 0 && !filter.includeKeywords.some((keyword) => subject.includes(normalizeText(keyword)))) {
    return { qualified: false, reason: "NO_INCLUDED_KEYWORD" };
  }

  const workTypes = detectWorkTypes(candidate.subject);
  if (filter.workTypes.length > 0 && !workTypes.some((workType) => filter.workTypes.includes(workType))) {
    return { qualified: false, reason: "WORK_TYPE" };
  }

  // Valor sigiloso é comum em obras sob a Lei 14.133: o orçamento só é revelado
  // após a fase de lances. Não pode ser tratado como valor zero.
  if (candidate.valueUndisclosed || candidate.estimatedValue === undefined) {
    if (!filter.includeUndisclosedValue) return { qualified: false, reason: "UNDISCLOSED_VALUE" };
  } else {
    if (filter.minimumValue !== undefined && candidate.estimatedValue < filter.minimumValue) {
      return { qualified: false, reason: "MINIMUM_VALUE" };
    }
    if (filter.maximumValue !== undefined && candidate.estimatedValue > filter.maximumValue) {
      return { qualified: false, reason: "MAXIMUM_VALUE" };
    }
  }

  if (!candidate.proposalClosesAt || daysUntil(candidate.proposalClosesAt, reference) < filter.minimumDaysToClose) {
    return { qualified: false, reason: "DEADLINE" };
  }

  return { qualified: true, workTypes };
}

/**
 * Condições sinalizadas para exibição na fila. O descarte por condição só pode
 * ocorrer depois da leitura do edital, por isso não acontece aqui.
 */
export function flaggedConditions(filter: ScoutFilter): readonly ScoutCondition[] {
  return scoutConditions.filter((condition) => treatmentFor(filter, condition) === "FLAG");
}
