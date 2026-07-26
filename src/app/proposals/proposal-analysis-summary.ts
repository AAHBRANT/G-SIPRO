export type ProposalAnalysisField = {
  field: string;
  value: string;
};

export type ProposalAnalysisSummary = ProposalAnalysisField & {
  category: string;
};

const categories: Array<{ label: string; pattern: RegExp }> = [
  { label: "Identificação", pattern: /objeto|órgão|orgao|cliente|contratante|modalidade|processo|edital/i },
  { label: "Prazos", pattern: /prazo|data|entrega|visita|validade|vigência|vigencia|cronograma/i },
  { label: "Comercial", pattern: /valor|preço|preco|orçamento|orcamento|pagamento|reajuste|garantia/i },
  { label: "Capacidade operacional", pattern: /capacidade|qualificação técnica|qualificacao tecnica|atestado|acervo|experiência|experiencia|serviço|servico/i },
  { label: "Econômico-financeira", pattern: /financeir|balanço|balanco|índice|indice|capital|patrimônio|patrimonio/i },
  { label: "Jurídica e documental", pattern: /habilitação|habilitacao|certid|document|jurídic|juridic|declaração|declaracao/i },
  { label: "Riscos e pendências", pattern: /risco|pendência|pendencia|impedimento|restrição|restricao|não localizado|nao localizado/i },
];

export function parseProposalAnalysisFields(value: unknown): ProposalAnalysisField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("field" in entry) ||
      !("value" in entry) ||
      typeof entry.field !== "string" ||
      typeof entry.value !== "string"
    ) {
      return [];
    }
    const field = entry.field.trim();
    const fieldValue = entry.value.trim();
    return field && fieldValue ? [{ field, value: fieldValue }] : [];
  });
}

export function buildProposalAnalysisSummary(
  fields: ProposalAnalysisField[],
  limit = 7,
): ProposalAnalysisSummary[] {
  const selected: ProposalAnalysisSummary[] = [];
  const used = new Set<number>();

  for (const category of categories) {
    const index = fields.findIndex((item, itemIndex) => !used.has(itemIndex) && category.pattern.test(`${item.field} ${item.value}`));
    if (index < 0) continue;
    selected.push({ ...fields[index], category: category.label });
    used.add(index);
    if (selected.length >= limit) return selected;
  }

  for (let index = 0; index < fields.length && selected.length < limit; index += 1) {
    if (used.has(index)) continue;
    selected.push({ ...fields[index], category: "Informação relevante" });
  }

  return selected;
}

export function compactProposalAnalysisValue(value: string, maximumLength = 260) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maximumLength
    ? `${normalized.slice(0, maximumLength - 1).trimEnd()}…`
    : normalized;
}
