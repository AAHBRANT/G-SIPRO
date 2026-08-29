import { describe, expect, it } from "vitest";

import { parsePncpIdentifier } from "@/modules/scouting/domain/pncp-identifier";

describe("parsePncpIdentifier", () => {
  it("lê CNPJ, ano e sequencial do número de controle", () => {
    // Formato conferido contra o serviço real do PNCP.
    expect(parsePncpIdentifier("07658917000127-1-000114/2025")).toEqual({
      authorityDocument: "07658917000127",
      year: 2025,
      sequence: 114,
    });
  });

  it("descarta os zeros à esquerda do sequencial", () => {
    expect(parsePncpIdentifier("07954480000179-1-000019/2026")?.sequence).toBe(19);
  });

  it("aceita sequencial de mais de seis dígitos", () => {
    expect(parsePncpIdentifier("07954480000179-1-1234567/2026")?.sequence).toBe(1_234_567);
  });

  it("ignora espaço em volta", () => {
    expect(parsePncpIdentifier("  07954480000179-1-000019/2026  ")?.sequence).toBe(19);
  });

  /**
   * Devolver nulo importa mais do que parece: chutar as partes de um formato
   * que não bate levaria a pedir o edital de OUTRA licitação, e a lista de
   * pré-requisitos sairia toda errada com cara de certa.
   */
  it.each([
    ["", "vazio"],
    ["sem-formato", "texto solto"],
    ["123-1-000019/2026", "CNPJ curto"],
    ["07954480000179-1-000019/26", "ano de dois dígitos"],
    ["07954480000179/2026", "sem o sequencial"],
    ["07954480000179-1-0/2026", "sequencial zero"],
    ["07954480000179-1-000019/1999", "ano fora da faixa"],
    ["0795448000017A-1-000019/2026", "letra no CNPJ"],
  ])("devolve nulo para %s (%s)", (entrada) => {
    expect(parsePncpIdentifier(entrada)).toBeNull();
  });
});
