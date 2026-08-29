import { describe, expect, it } from "vitest";
import { detailFields, fieldsFromExtractionOutput, servicesFromExtraction } from "@/modules/technical-archive/domain/extracted-services";

describe("technical archive extraction view model", () => {
  it("reads the direct array format persisted by the extraction repository", () => {
    expect(fieldsFromExtractionOutput([{ field: "Contratante", value: "Cliente A" }])).toEqual([
      { field: "Contratante", value: "Cliente A" },
    ]);
  });

  it("remains compatible with the legacy wrapped content format", () => {
    expect(fieldsFromExtractionOutput({ content: [{ field: "Objeto", value: "Obra B" }] })).toEqual([
      { field: "Objeto", value: "Obra B" },
    ]);
  });

  it("converts recognized services to table rows", () => {
    const fields = [{
      field: "Serviços executados e quantidades",
      value: JSON.stringify([{ disciplina: "OAE", servico: "Ponte", quantidade: "120", unidade: "m" }]),
    }];
    expect(servicesFromExtraction(fields)).toEqual([
      { discipline: "OAE", description: "Ponte", quantities: "120 m" },
    ]);
  });

  it("keeps recognized metadata but omits the raw services field when its table is available", () => {
    const fields = [
      { field: "Contratante", value: "Cliente A" },
      { field: "Objeto", value: "Obra B" },
      { field: "Serviços executados e quantidades", value: "[{...}]" },
    ];

    expect(detailFields(fields, true)).toEqual([
      { field: "Contratante", value: "Cliente A" },
      { field: "Objeto", value: "Obra B" },
    ]);
    expect(detailFields(fields, false)).toEqual(fields);
  });
});
