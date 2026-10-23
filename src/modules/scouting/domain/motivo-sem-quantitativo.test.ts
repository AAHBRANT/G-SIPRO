import { describe, expect, it } from "vitest";

import {
  MOTIVO_DIGITALIZADO,
  MOTIVO_NAO_ENCONTRADO,
  MOTIVO_REMISSAO,
  MOTIVO_SO_SIMILAR,
  motivoSemQuantitativo,
} from "@/modules/scouting/domain/motivo-sem-quantitativo";

/** Trechos no formato dos editais do corpus de 140 obras (out/2026). */
describe("motivoSemQuantitativo", () => {
  it("documentos abertos e nenhum com texto: digitalizados", () => {
    expect(motivoSemQuantitativo(["", "  "], ["EDITAL.pdf", "TR.pdf"])).toBe(MOTIVO_DIGITALIZADO);
  });

  it("nada aberto: não inventa motivo", () => {
    expect(motivoSemQuantitativo([], [])).toBeUndefined();
  });

  it("DER/PR: quantidades conforme item do Anexo I – TR, e o TR não foi lido", () => {
    const edital = "14.1.16 Qualificação técnica: Certidão(ões) ou Atestado(s) de que a licitante tenha executado serviços em quantidades iguais ou superiores conforme item 9.1.3 do Anexo I – Termo de Referência deste Edital.";
    expect(motivoSemQuantitativo([edital], ["Edital.pdf"])).toBe(MOTIVO_REMISSAO);
  });

  it("com o TR entre os lidos, a remissão não vira motivo — o problema é outro", () => {
    const edital = "Qualificação técnica: quantidades conforme item 9.1.3 do Anexo I – Termo de Referência.";
    expect(motivoSemQuantitativo([edital, "texto do TR"], ["Edital.pdf", "ANEXO I - TERMO DE REFERENCIA.pdf"])).toBe(MOTIVO_NAO_ENCONTRADO);
  });

  it("só pede obra similar, sem quantitativo", () => {
    const edital = "9.3 Qualificação técnico-operacional: comprovação de aptidão por meio de atestado de execução de obra de características semelhantes ao objeto desta licitação.";
    expect(motivoSemQuantitativo([edital], ["Edital.pdf"])).toBe(MOTIVO_SO_SIMILAR);
  });

  it("'similar' com sinal de quantitativo no texto: não afirma que não exige — diz que não encontrou", () => {
    const edital = "Qualificação técnico-operacional: atestado de obra similar, em quantidade não inferior a 50% (planilha anexa).";
    expect(motivoSemQuantitativo([edital], ["Edital.pdf"])).toBe(MOTIVO_NAO_ENCONTRADO);
  });

  it("texto sem seção de qualificação técnica: só diz que não encontrou", () => {
    expect(motivoSemQuantitativo(["Aviso de licitação. Obra de características semelhantes."], ["Aviso.pdf"])).toBe(MOTIVO_NAO_ENCONTRADO);
  });
});
