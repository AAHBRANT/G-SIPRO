import { z } from "zod";

/**
 * Condições do certame que só são conhecidas com a leitura do edital e do termo
 * de referência — a consulta pública não as informa. Reproduzem o quadro de
 * conferência usado pela equipe de licitações.
 */
export const scoutConditions = [
  "IN_PERSON_SESSION",
  "REGISTRATION_REQUIRED",
  "CONSORTIUM_FORBIDDEN",
  "TENDER_BOND",
  "UNIT_PRICE_COMPOSITION",
  "TECHNICAL_PROPOSAL",
  "MANDATORY_SITE_VISIT",
] as const;

/**
 * Tratamento escolhido pela equipe para cada condição.
 * IGNORE não interfere; FLAG traz a licitação com marca de atenção; DISCARD a
 * remove da fila. O padrão é FLAG porque o quadro da equipe existe para avisar,
 * não para excluir — o descarte é silencioso e pode esconder uma boa obra.
 */
export const conditionTreatments = ["IGNORE", "FLAG", "DISCARD"] as const;

export const scoutSpheres = ["F", "E", "M", "D"] as const;

export const scoutWorkTypes = [
  "BUILDING",
  "SPECIAL_STRUCTURE",
  "PAVING",
  "URBAN_INFRASTRUCTURE",
  "SANITATION",
  "EARTHWORKS",
  "RENOVATION",
] as const;

export type ScoutCondition = (typeof scoutConditions)[number];
export type ConditionTreatment = (typeof conditionTreatments)[number];
export type ScoutSphere = (typeof scoutSpheres)[number];
export type ScoutWorkType = (typeof scoutWorkTypes)[number];

const keywordSchema = z.string().trim().min(2).max(120);

export const scoutFilterSchema = z.object({
  includeKeywords: z.array(keywordSchema).max(60).default([]),
  excludeKeywords: z.array(keywordSchema).max(60).default([]),
  workTypes: z.array(z.enum(scoutWorkTypes)).max(scoutWorkTypes.length).default([]),
  states: z.array(z.string().trim().toUpperCase().length(2)).max(27).default([]),
  spheres: z.array(z.enum(scoutSpheres)).min(1).max(scoutSpheres.length).default(["F", "E", "M"]),
  minimumValue: z.coerce.number().nonnegative().optional(),
  maximumValue: z.coerce.number().nonnegative().optional(),
  minimumDaysToClose: z.coerce.number().int().min(0).max(120).default(10),
  includeUndisclosedValue: z.boolean().default(true),
  conditionTreatments: z.partialRecord(z.enum(scoutConditions), z.enum(conditionTreatments)).default({}),
}).superRefine((value, context) => {
  if (value.minimumValue !== undefined && value.maximumValue !== undefined && value.minimumValue > value.maximumValue) {
    context.addIssue({ code: "custom", path: ["maximumValue"], message: "O valor máximo deve ser maior ou igual ao mínimo." });
  }
});

export type ScoutFilter = z.infer<typeof scoutFilterSchema>;

/**
 * Configuração inicial sugerida à equipe: nada é descartado automaticamente.
 * Todas as condições relevantes apenas sinalizam, para que nenhuma oportunidade
 * desapareça da fila sem alguém ver.
 */
export const defaultScoutFilter: ScoutFilter = Object.freeze({
  includeKeywords: ["obra", "construção", "reforma", "pavimentação", "ponte", "viaduto"],
  excludeKeywords: ["mão de obra", "locação", "manutenção predial"],
  workTypes: ["BUILDING", "SPECIAL_STRUCTURE", "PAVING", "URBAN_INFRASTRUCTURE"],
  states: [],
  spheres: ["F", "E", "M"],
  // Abaixo desta faixa a obra não compensa a mobilização. Certame de valor
  // sigiloso entra mesmo assim: orçamento fechado é comum justamente em obra
  // grande, e descartá-lo eliminaria o alvo.
  minimumValue: 14_000_000,
  maximumValue: undefined,
  minimumDaysToClose: 10,
  includeUndisclosedValue: true,
  conditionTreatments: {
    IN_PERSON_SESSION: "FLAG",
    REGISTRATION_REQUIRED: "FLAG",
    CONSORTIUM_FORBIDDEN: "IGNORE",
    TENDER_BOND: "FLAG",
    UNIT_PRICE_COMPOSITION: "IGNORE",
    TECHNICAL_PROPOSAL: "FLAG",
    MANDATORY_SITE_VISIT: "FLAG",
  },
} satisfies ScoutFilter);

export function treatmentFor(filter: ScoutFilter, condition: ScoutCondition): ConditionTreatment {
  return filter.conditionTreatments[condition] ?? "IGNORE";
}
