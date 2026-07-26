import { describe, expect, it } from "vitest";

import { collectAnalysisContextDefaults } from "./analysis-context-defaults";

describe("collectAnalysisContextDefaults", () => {
  it("obtém somente dados explícitos dos documentos vinculados", () => {
    expect(collectAnalysisContextDefaults([{
      title: "Termo de Referência",
      analysis: { output: [
        { field: "Local da obra", value: "Campinas/SP" },
        { field: "Latitude da obra", value: "-22,9056" },
        { field: "Longitude da obra", value: "-47,0608" },
        { field: "Data de início da execução", value: "10/01/2027" },
        { field: "Data de término da execução", value: "2027-12-20" },
      ] },
    }])).toEqual({
      locationLabel: "Campinas/SP",
      latitude: -22.9056,
      longitude: -47.0608,
      workStart: "2027-01-10",
      workEnd: "2027-12-20",
      sources: ["Termo de Referência"],
    });
  });

  it("não presume contexto a partir de campos genéricos", () => {
    expect(collectAnalysisContextDefaults([{
      title: "Edital",
      analysis: { output: [
        { field: "Objeto", value: "Obra em São Paulo" },
        { field: "Prazo", value: "12 meses" },
      ] },
    }])).toEqual({ sources: [] });
  });
});
