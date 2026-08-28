import { detectWorkTypes, daysUntil } from "@/modules/scouting/domain/qualification";
import type { ScoutFilter, ScoutWorkType } from "@/modules/scouting/domain/scout-filter";

/**
 * Aderência ao PERFIL da empresa — quanto a licitação combina com o que a
 * AAHBRANT faz e com o porte que suporta.
 *
 * ⚠️ NÃO é aderência de acervo técnico. Acervo exigido só existe no edital, que
 * ainda não é lido pelo sistema; por isso a linha continua marcada como "acervo
 * não verificado". Confundir os dois levaria a equipe a confiar num número que
 * não responde à pergunta que decide habilitação.
 *
 * O cálculo é determinístico e explicável: cada critério vale um peso, e a nota
 * é a fração dos pesos atendidos. Critério que não pode ser julgado com os dados
 * disponíveis — valor sigiloso é o caso comum — sai do numerador E do
 * denominador, em vez de virar zero ou nota cheia. Assim a nota nunca finge
 * saber o que não sabe, e o motivo aparece na tela.
 */

export const adherenceCriteria = ["WORK_TYPE", "VALUE", "DEADLINE", "SPHERE"] as const;
export type AdherenceCriterion = (typeof adherenceCriteria)[number];

/**
 * Tipo de obra pesa mais porque é o que define se a empresa sabe executar.
 * Porte vem em seguida: abaixo do piso a mobilização não se paga.
 */
const weights: Readonly<Record<AdherenceCriterion, number>> = {
  WORK_TYPE: 40,
  VALUE: 30,
  DEADLINE: 20,
  SPHERE: 10,
};

export type AdherenceReason = Readonly<{
  criterion: AdherenceCriterion;
  /** Texto curto para a etiqueta na linha da fila. */
  label: string;
  met: boolean;
  /** Não havia dado para julgar; não conta a favor nem contra. */
  skipped: boolean;
}>;

export type Adherence = Readonly<{
  /** 0 a 100, arredondado. */
  score: number;
  reasons: readonly AdherenceReason[];
  /** Tipos reconhecidos, já com o texto do objeto como reserva. */
  workTypes: readonly ScoutWorkType[];
  /** Nenhum critério pôde ser julgado — a nota não significa nada. */
  undetermined: boolean;
}>;

export type AdherenceInput = Readonly<{
  subject: string;
  sphere: string;
  workTypes?: readonly string[];
  estimatedValue?: number;
  valueUndisclosed: boolean;
  proposalClosesAt?: Date;
}>;

const workTypeLabels: Readonly<Record<ScoutWorkType, string>> = {
  BUILDING: "edificação",
  SPECIAL_STRUCTURE: "obra de arte especial",
  PAVING: "pavimentação",
  URBAN_INFRASTRUCTURE: "infraestrutura urbana",
  SANITATION: "saneamento",
  EARTHWORKS: "contenção",
  RENOVATION: "reforma",
};

const sphereLabels: Readonly<Record<string, string>> = { F: "federal", E: "estadual", M: "municipal", D: "distrital" };

const millions = (value: number) =>
  `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;

/**
 * Registros capturados antes da coluna `workTypes` existir (migração de
 * 12/08/2026) têm o campo vazio. Ler o objeto de novo custa nada e evita que a
 * fila antiga apareça sem etiqueta e escape do filtro por tipo de obra.
 */
export function resolveWorkTypes(input: AdherenceInput): readonly ScoutWorkType[] {
  const stored = (input.workTypes ?? []).filter((entry): entry is ScoutWorkType =>
    Object.hasOwn(workTypeLabels, entry),
  );
  return stored.length > 0 ? stored : detectWorkTypes(input.subject);
}

export function computeAdherence(input: AdherenceInput, filter: ScoutFilter, reference: Date): Adherence {
  const workTypes = resolveWorkTypes(input);
  const reasons: AdherenceReason[] = [];

  // Tipo de obra
  const wanted = workTypes.filter((workType) => filter.workTypes.includes(workType));
  const matched = filter.workTypes.length === 0 ? workTypes : wanted;
  reasons.push({
    criterion: "WORK_TYPE",
    label: matched.length > 0 ? matched.map((workType) => workTypeLabels[workType]).join(" · ") : "tipo de obra não reconhecido",
    met: matched.length > 0,
    skipped: false,
  });

  // Porte
  const floor = filter.minimumValue;
  if (input.valueUndisclosed || input.estimatedValue === undefined) {
    reasons.push({ criterion: "VALUE", label: "valor sigiloso — porte não confirmado", met: false, skipped: true });
  } else if (floor === undefined) {
    reasons.push({ criterion: "VALUE", label: "sem piso configurado", met: false, skipped: true });
  } else {
    const met = input.estimatedValue >= floor;
    reasons.push({
      criterion: "VALUE",
      label: met ? `acima do piso de ${millions(floor)}` : `abaixo do piso de ${millions(floor)}`,
      met,
      skipped: false,
    });
  }

  // Prazo
  if (!input.proposalClosesAt) {
    reasons.push({ criterion: "DEADLINE", label: "sem prazo informado", met: false, skipped: true });
  } else {
    const days = daysUntil(input.proposalClosesAt, reference);
    const met = days >= filter.minimumDaysToClose;
    reasons.push({
      criterion: "DEADLINE",
      label: days < 0 ? "prazo encerrado" : days === 0 ? "encerra hoje" : `${days} dias para preparar`,
      met,
      skipped: false,
    });
  }

  // Esfera
  const met = filter.spheres.length === 0 || filter.spheres.some((sphere) => sphere === input.sphere);
  reasons.push({
    criterion: "SPHERE",
    label: sphereLabels[input.sphere] ?? input.sphere,
    met,
    skipped: false,
  });

  const judged = reasons.filter((reason) => !reason.skipped);
  const available = judged.reduce((total, reason) => total + weights[reason.criterion], 0);
  const earned = judged.reduce((total, reason) => total + (reason.met ? weights[reason.criterion] : 0), 0);

  return {
    score: available === 0 ? 0 : Math.round((earned / available) * 100),
    reasons,
    workTypes,
    undetermined: available === 0,
  };
}
