import { parseProposalAnalysisFields } from "@/app/proposals/proposal-analysis-summary";

export type RequestedService = Readonly<{
  item: string;
  requirement: string;
  source: string;
}>;

const servicePattern = /servi[cç]o|escopo|quantidade|planilha|item(?:\s+solicitado)?/i;

export function collectRequestedServices(
  documents: readonly { title: string; analysis: null | { output: unknown } }[],
): RequestedService[] {
  const seen = new Set<string>();
  const result: RequestedService[] = [];

  for (const document of documents) {
    for (const field of parseProposalAnalysisFields(document.analysis?.output)) {
      if (!servicePattern.test(`${field.field} ${field.value}`)) continue;
      const key = `${field.field.trim().toLocaleLowerCase("pt-BR")}|${field.value.trim().toLocaleLowerCase("pt-BR")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        item: field.field.trim(),
        requirement: field.value.trim(),
        source: document.title,
      });
    }
  }

  return result.slice(0, 50);
}
