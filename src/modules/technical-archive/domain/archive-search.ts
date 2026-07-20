import { z } from "zod";

const optionalText = (maximum: number) => z.preprocess(
  value => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).max(maximum).optional(),
);

const optionalNumber = z.preprocess(
  value => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().nonnegative().max(1e12).optional(),
);

export const archiveSearchSchema = z.object({
  discipline: optionalText(120),
  service: optionalText(500),
  characteristic: optionalText(500),
  minQuantity: optionalNumber,
  maxQuantity: optionalNumber,
  unit: optionalText(40),
  page: z.coerce.number().int().positive().max(10_000).default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(25),
}).strict().superRefine((value, context) => {
  const hasFilter = value.discipline || value.service || value.characteristic || value.minQuantity !== undefined || value.maxQuantity !== undefined || value.unit;
  if (!hasFilter) context.addIssue({ code: "custom", path: ["discipline"], message: "Informe pelo menos um filtro de pesquisa." });
  if ((value.minQuantity !== undefined || value.maxQuantity !== undefined) && !value.unit) {
    context.addIssue({ code: "custom", path: ["unit"], message: "A unidade é obrigatória ao pesquisar quantitativos." });
  }
  if (value.minQuantity !== undefined && value.maxQuantity !== undefined && value.maxQuantity < value.minQuantity) {
    context.addIssue({ code: "custom", path: ["maxQuantity"], message: "O quantitativo máximo não pode ser menor que o mínimo." });
  }
});

export type ArchiveSearchCriteria = z.infer<typeof archiveSearchSchema>;

