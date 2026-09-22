import { describe, expect, it } from "vitest";

import { completarAcervo, extrairQuantitativosDaDescricao, faltaAcervo, parcelasComQuantitativo, quantitativoNaDescricao } from "@/modules/scouting/domain/acervo-exigido";
import type { EditalRequirement } from "@/modules/scouting/domain/edital-requirement";

const leitura = (parcial: Partial<EditalRequirement> = {}): EditalRequirement => ({
  services: [],
  limitations: [],
  ...parcial,
});

describe("quando falta acervo", () => {
  it("sem parcela nenhuma, falta", () => {
    expect(faltaAcervo(leitura())).toBe(true);
  });

  /** É o estado que a tela mostra como "sem quantitativo no edital". */
  it("com parcelas, mas nenhuma com quantitativo, falta", () => {
    const sem = leitura({ services: [{ description: "Pavimentação asfáltica" }, { description: "Drenagem" }] });
    expect(faltaAcervo(sem)).toBe(true);
  });

  it("basta uma parcela com quantitativo para não faltar", () => {
    const com = leitura({
      services: [{ description: "Pavimentação asfáltica", quantity: 30_000, unit: "m²" }, { description: "Drenagem" }],
    });
    expect(faltaAcervo(com)).toBe(false);
    expect(parcelasComQuantitativo(com)).toBe(1);
  });
});

describe("completar o acervo com o que veio do anexo", () => {
  /**
   * O caso que motivou tudo: o edital lista a parcela e remete o quantitativo
   * a outro documento. A fusão comum descartaria a parcela repetida e perderia
   * justamente o número que se foi buscar.
   */
  it("preenche o quantitativo de uma parcela que já existia sem número", () => {
    const base = leitura({ services: [{ description: "Pavimentação asfáltica em CBUQ" }] });
    const anexo = leitura({ services: [{ description: "Pavimentação asfáltica em CBUQ", quantity: 30_000, unit: "m²" }] });

    const resultado = completarAcervo(base, anexo);

    expect(resultado.services).toHaveLength(1);
    expect(resultado.services[0]).toEqual({
      description: "Pavimentação asfáltica em CBUQ",
      quantity: 30_000,
      unit: "m²",
    });
  });

  /** A base veio do documento mais específico: o anexo nunca passa por cima. */
  it("não substitui quantitativo que a base já tinha", () => {
    const base = leitura({ services: [{ description: "Pavimentação", quantity: 30_000, unit: "m²" }] });
    const anexo = leitura({ services: [{ description: "Pavimentação", quantity: 999, unit: "m²" }] });

    expect(completarAcervo(base, anexo).services[0]?.quantity).toBe(30_000);
  });

  it("acrescenta parcela que a base não tinha", () => {
    const base = leitura({ services: [{ description: "Pavimentação" }] });
    const anexo = leitura({ services: [{ description: "Ponte em concreto armado", quantity: 120, unit: "m" }] });

    expect(completarAcervo(base, anexo).services.map((s) => s.description))
      .toEqual(["Pavimentação", "Ponte em concreto armado"]);
  });

  /** Acento e caixa não podem criar parcela duplicada. */
  it("casa a mesma parcela escrita de outro jeito", () => {
    const base = leitura({ services: [{ description: "PAVIMENTAÇÃO  ASFÁLTICA" }] });
    const anexo = leitura({ services: [{ description: "pavimentacao asfaltica", quantity: 500, unit: "m²" }] });

    const resultado = completarAcervo(base, anexo);
    expect(resultado.services).toHaveLength(1);
    expect(resultado.services[0]?.quantity).toBe(500);
    // O texto da base é preservado: é o do documento mais específico.
    expect(resultado.services[0]?.description).toBe("PAVIMENTAÇÃO  ASFÁLTICA");
  });

  it("anexo sem nada não muda a base", () => {
    const base = leitura({ services: [{ description: "Pavimentação", quantity: 100, unit: "m²" }] });
    expect(completarAcervo(base, leitura())).toEqual(base);
  });

  it("preserva o que não é parcela", () => {
    const base = leitura({ services: [], consortiumAllowed: false, requiresCat: true, limitations: ["x"] });
    const resultado = completarAcervo(base, leitura({ services: [{ description: "Ponte", quantity: 10, unit: "m" }] }));

    expect(resultado.consortiumAllowed).toBe(false);
    expect(resultado.requiresCat).toBe(true);
    expect(resultado.limitations).toEqual(["x"]);
  });

  /** Parcela sem unidade não ganha unidade inventada. */
  it("não inventa unidade quando o anexo não trouxe", () => {
    const base = leitura({ services: [{ description: "Terraplenagem" }] });
    const anexo = leitura({ services: [{ description: "Terraplenagem", quantity: 5_000 }] });

    expect(completarAcervo(base, anexo).services[0]).toEqual({ description: "Terraplenagem", quantity: 5_000 });
  });
});

describe("quantitativo escrito dentro da descrição", () => {
  /**
   * Frases medidas em editais reais do PNCP (Vitória/ES, macrodrenagem, e o
   * formato mais comum de obra). O número está na frase, e o campo próprio
   * vem vazio — era isto que fazia a tela dizer "sem quantitativo".
   */
  it.each([
    ["Sistema de Bombeamento Operado à distância – vazão mínima 7,5 m³/s", 7.5, "m³"],
    ["execução de pavimentação asfáltica em no mínimo 30.000 m²", 30_000, "m²"],
    ["rede de drenagem, mínimo de 1.200 m", 1_200, "m"],
    ["ponte em concreto armado com extensão mínima: 120 m", 120, "m"],
  ])("extrai de %s", (frase, quantidade, unidade) => {
    expect(quantitativoNaDescricao(frase)).toEqual({ quantity: quantidade, unit: unidade });
  });

  /** Sem âncora de mínimo, qualquer número da frase seria chute. */
  it.each([
    "Elaboração de Projeto Executivo de galerias e canais pré-moldados",
    "Item 3.2 do anexo II, conforme norma ABNT NBR 7480",
    "Reservatório subterrâneo para amortecimento de cheias",
  ])("não inventa quantitativo em %s", (frase) => {
    expect(quantitativoNaDescricao(frase)).toBeNull();
  });

  it("não confunde contagem com unidade de obra", () => {
    expect(quantitativoNaDescricao("comprovação em no mínimo 3 contratos distintos")).toBeNull();
  });

  it("completa só as parcelas que estavam sem número", () => {
    const antes = leitura({
      services: [
        { description: "Pavimentação asfáltica em no mínimo 30.000 m²" },
        { description: "Drenagem urbana", quantity: 500, unit: "m" },
        { description: "Reservatório subterrâneo" },
      ],
    });

    const depois = extrairQuantitativosDaDescricao(antes);

    expect(depois.services[0]).toEqual({ description: "Pavimentação asfáltica em no mínimo 30.000 m²", quantity: 30_000, unit: "m²" });
    expect(depois.services[1]).toEqual({ description: "Drenagem urbana", quantity: 500, unit: "m" });
    expect(depois.services[2]).toEqual({ description: "Reservatório subterrâneo" });
  });

  it("sem nada a extrair, devolve a mesma leitura", () => {
    const original = leitura({ services: [{ description: "Reservatório subterrâneo" }] });
    expect(extrairQuantitativosDaDescricao(original)).toBe(original);
  });
});
