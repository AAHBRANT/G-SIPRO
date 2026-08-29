export type ExtractionField = { field: string; value: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function fieldsFromExtractionOutput(output: unknown): ExtractionField[] {
  const content = Array.isArray(output)
    ? output
    : isRecord(output) && Array.isArray(output.content)
      ? output.content
      : [];

  return content.flatMap((item) => {
    if (!isRecord(item) || typeof item.field !== "string" || typeof item.value !== "string") return [];
    return [{ field: item.field, value: item.value }];
  });
}

export function detailFields(fields: ExtractionField[], hasServiceTable: boolean) {
  if (!hasServiceTable) return fields;
  return fields.filter((item) => !/serviços executados e quantidades/i.test(item.field));
}

export function servicesFromExtraction(fields: ExtractionField[]) {
  const serviceField = fields.find((item) => /serviços executados e quantidades/i.test(item.field));
  if (!serviceField) return [];

  try {
    const parsed = JSON.parse(serviceField.value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!isRecord(item)) return [];
      const description = typeof item.servico === "string" ? item.servico : typeof item.descricao === "string" ? item.descricao : undefined;
      if (!description) return [];
      const quantity = [item.quantidade, item.unidade]
        .filter((value) => typeof value === "string" || typeof value === "number")
        .join(" ")
        .trim();
      return [{
        discipline: typeof item.disciplina === "string" ? item.disciplina : "Não informada",
        description,
        quantities: quantity || "Não informada",
      }];
    });
  } catch {
    return [];
  }
}
