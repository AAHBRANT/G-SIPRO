import { describe, expect, it } from "vitest";

import { montarPacote, nomeSemColisao, type ConteudoBaixado } from "@/modules/scouting/domain/pacote-de-documentos";

const conteudo = (nome: string, tamanho: number): ConteudoBaixado => ({
  filename: nome,
  bytes: new Uint8Array(tamanho),
});

describe("nomes dentro do pacote", () => {
  /** "ANEXO I.pdf" publicado duas vezes acontece de verdade. */
  it("desempata nome repetido em vez de sobrescrever", () => {
    const usados = new Set<string>();
    expect(nomeSemColisao("ANEXO I.pdf", usados)).toBe("ANEXO I.pdf");
    expect(nomeSemColisao("ANEXO I.pdf", usados)).toBe("ANEXO I (2).pdf");
    expect(nomeSemColisao("ANEXO I.pdf", usados)).toBe("ANEXO I (3).pdf");
  });

  it("desempata também quando o arquivo não tem extensão", () => {
    const usados = new Set<string>();
    nomeSemColisao("MEMORIAL", usados);
    expect(nomeSemColisao("MEMORIAL", usados)).toBe("MEMORIAL (2)");
  });
});

describe("montagem do pacote", () => {
  it("junta todos os documentos quando cabem", async () => {
    const pacote = await montarPacote(
      ["EDITAL", "PROJETOS"],
      async (t) => conteudo(`${t}.pdf`, 10),
      (t) => t,
    );
    expect(pacote.entradas.map((e) => e.nome)).toEqual(["EDITAL.pdf", "PROJETOS.pdf"]);
    expect(pacote.bytesTotais).toBe(20);
    expect(pacote.ignorados).toEqual([]);
  });

  /**
   * O que não couber tem de ser DITO. Entregar um zip menor em silêncio faria
   * a equipe montar proposta achando que tem todos os anexos.
   */
  it("corta no teto e nomeia o que ficou de fora", async () => {
    const pacote = await montarPacote(
      ["PEQUENO", "GIGANTE"],
      async (t) => conteudo(`${t}.pdf`, t === "GIGANTE" ? 500 : 10),
      (t) => t,
      100,
    );
    expect(pacote.entradas.map((e) => e.nome)).toEqual(["PEQUENO.pdf"]);
    expect(pacote.ignorados).toEqual(["GIGANTE — não coube no limite do pacote"]);
  });

  /** Um gigante no meio não pode impedir os pequenos que vêm depois dele. */
  it("segue baixando o que vem depois do que não coube", async () => {
    const pacote = await montarPacote(
      ["GIGANTE", "PLANILHA"],
      async (t) => conteudo(`${t}.pdf`, t === "GIGANTE" ? 500 : 10),
      (t) => t,
      100,
    );
    expect(pacote.entradas.map((e) => e.nome)).toEqual(["PLANILHA.pdf"]);
  });

  it("anexo fora do ar não derruba o pacote inteiro", async () => {
    const pacote = await montarPacote(
      ["EDITAL", "SUMIU"],
      async (t) => {
        if (t === "SUMIU") throw new Error("PNCP respondeu 404");
        return conteudo(`${t}.pdf`, 10);
      },
      (t) => t,
    );
    expect(pacote.entradas).toHaveLength(1);
    expect(pacote.ignorados[0]).toContain("SUMIU");
    expect(pacote.ignorados[0]).toContain("404");
  });

  it("arquivo recusado pelo limite individual entra como ignorado", async () => {
    const pacote = await montarPacote(["ENORME"], async () => null, (t) => t);
    expect(pacote.entradas).toEqual([]);
    expect(pacote.ignorados).toEqual(["ENORME — maior que o limite por arquivo"]);
  });
});
