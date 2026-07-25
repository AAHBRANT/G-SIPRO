import { describe, expect, it } from "vitest";

import { collectRequestedServices } from "./requested-services";

describe("collectRequestedServices", () => {
  it("keeps only service-related fields and records the source document", () => {
    expect(collectRequestedServices([{
      title: "Edital 01",
      analysis: { output: [
        { field: "Objeto", value: "Execução de obra" },
        { field: "Serviços solicitados", value: "Terraplenagem — 2.000 m³" },
      ] },
    }])).toEqual([{
      item: "Serviços solicitados",
      requirement: "Terraplenagem — 2.000 m³",
      source: "Edital 01",
    }]);
  });

  it("removes duplicate extracted items", () => {
    expect(collectRequestedServices([{
      title: "TR",
      analysis: { output: [
        { field: "Quantidade", value: "10 km" },
        { field: "Quantidade", value: "10 km" },
      ] },
    }])).toHaveLength(1);
  });
});
