import { describe, expect, it } from "vitest";

import { inferAuthorityHintFromDocuments } from "./authority-hint";

describe("inferAuthorityHintFromDocuments", () => {
  it("reconhece o órgão contratante extraído dos documentos analisados", () => {
    const hint = inferAuthorityHintFromDocuments([{
      analysis: { output: [
        { field: "Objeto", value: "Execução de obra" },
        { field: "Órgão Contratante", value: "Prefeitura de Gravataí" },
      ] },
    }]);
    expect(hint).toEqual({ raw: "Prefeitura de Gravataí", suggestedName: "Prefeitura de Gravataí" });
  });

  it("ignora campos cujo valor não segue um padrão reconhecível de órgão público", () => {
    const hint = inferAuthorityHintFromDocuments([{
      analysis: { output: [
        { field: "Cliente", value: "Construtora ABC Ltda" },
      ] },
    }]);
    expect(hint).toBeUndefined();
  });

  it("não sugere nada quando nenhum documento tem análise", () => {
    expect(inferAuthorityHintFromDocuments([{ analysis: null }])).toBeUndefined();
  });

  it("procura no segundo documento quando o primeiro não traz o dado", () => {
    const hint = inferAuthorityHintFromDocuments([
      { analysis: { output: [{ field: "Objeto", value: "Execução de obra" }] } },
      { analysis: { output: [{ field: "Órgão", value: "Governo do Estado de Minas Gerais" }] } },
    ]);
    expect(hint?.suggestedName).toBe("Governo do Estado de Minas Gerais");
  });
});
