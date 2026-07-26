import { describe, expect, it } from "vitest";
import {
  buildProposalAnalysisSummary,
  compactProposalAnalysisValue,
  parseProposalAnalysisFields,
} from "./proposal-analysis-summary";

describe("proposal analysis summary", () => {
  it("ignores malformed extraction entries", () => {
    expect(parseProposalAnalysisFields([
      { field: "Objeto", value: "Construção de ponte" },
      { field: "Sem valor" },
      null,
    ])).toEqual([{ field: "Objeto", value: "Construção de ponte" }]);
  });

  it("prioritizes one representative standard item per category", () => {
    const summary = buildProposalAnalysisSummary([
      { field: "Objeto", value: "Obra pública" },
      { field: "Prazo de entrega", value: "30 dias" },
      { field: "Capacidade técnica", value: "Atestado compatível" },
      { field: "Valor estimado", value: "R$ 1.000.000,00" },
    ]);

    expect(summary.map((item) => item.category)).toEqual([
      "Identificação",
      "Prazos",
      "Comercial",
      "Capacidade operacional",
    ]);
  });

  it("compacts long text for the executive view", () => {
    expect(compactProposalAnalysisValue("a".repeat(300), 20)).toHaveLength(20);
  });
});
