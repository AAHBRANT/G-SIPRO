import { describe, expect, it } from "vitest";

import {
  percentual,
  proporcaoDeBarra,
  somaPreservandoAusencia,
  taxaMensal,
  ticketMedio,
  totaisDoPeriodo,
  type MesDoFunil,
} from "@/modules/analysis/domain/funil-comercial";

const mes = (parcial: Partial<MesDoFunil> = {}): MesDoFunil => ({
  mes: "2026-09-01",
  publicados: 300,
  quantidade: { aderentes: 200, aprovadas: 50, orcamento: 30, propostas: 12 },
  valor: { aderentes: 120_000_000, aprovadas: 35_000_000, orcamento: 22_000_000, propostas: 10_000_000 },
  ...parcial,
});

describe("percentual", () => {
  it("calcula o que deve calcular", () => {
    expect(percentual(50, 200)).toBe(25);
  });

  /**
   * Toda a razão de existir desta função: uma largura NaN é descartada pelo
   * navegador e a barra aparece cheia — ausência viraria "converteu tudo".
   */
  it.each([
    ["divisor zero", 50, 0],
    ["divisor negativo", 50, -10],
    ["divisor nulo", 50, null],
    ["dividendo nulo", null, 200],
  ])("devolve nulo com %s", (_caso, a, b) => {
    expect(percentual(a, b)).toBeNull();
  });

  it("não mascara inconsistência limitando em 100", () => {
    expect(percentual(150, 100)).toBe(150);
  });
});

describe("proporção de barra", () => {
  it("apara em 100 para desenhar, mas denuncia o transbordo", () => {
    expect(proporcaoDeBarra(150, 100)).toEqual({ largura: 100, transbordo: true });
  });

  it("proporção normal não é transbordo", () => {
    expect(proporcaoDeBarra(25, 100)).toEqual({ largura: 25, transbordo: false });
  });

  it("sem base, não existe barra — e nulo é diferente de zero", () => {
    expect(proporcaoDeBarra(25, null)).toBeNull();
    expect(proporcaoDeBarra(0, 100)).toEqual({ largura: 0, transbordo: false });
  });
});

describe("soma que preserva a ausência", () => {
  it("soma quando tudo é conhecido", () => {
    expect(somaPreservandoAusencia([10, 20, 30])).toBe(60);
  });

  /** Somar como se ausente fosse zero entregaria um total menor com cara de completo. */
  it("uma parcela desconhecida torna o total desconhecido", () => {
    expect(somaPreservandoAusencia([10, null, 30])).toBeNull();
  });

  it("lista vazia não tem soma", () => {
    expect(somaPreservandoAusencia([])).toBeNull();
  });
});

describe("ticket médio", () => {
  it("divide valor por licitação", () => {
    expect(ticketMedio(10_000_000, 20)).toBe(500_000);
  });

  it("sem licitação não há média, e isso não é zero", () => {
    expect(ticketMedio(10_000_000, 0)).toBeNull();
    expect(ticketMedio(null, 20)).toBeNull();
  });
});

describe("totais do período", () => {
  it("soma os meses e calcula o ticket de cada etapa", () => {
    const resumo = totaisDoPeriodo([mes(), mes()]);

    expect(resumo.publicados).toBe(600);
    const aderentes = resumo.etapas[0];
    expect(aderentes?.quantidade).toBe(400);
    expect(aderentes?.valor).toBe(240_000_000);
    expect(aderentes?.ticketMedio).toBe(600_000);
  });

  it("mantém a ordem do funil e os rótulos", () => {
    const resumo = totaisDoPeriodo([mes()]);
    expect(resumo.etapas.map((e) => e.etapa)).toEqual(["aderentes", "aprovadas", "orcamento", "propostas"]);
    expect(resumo.etapas[3]?.rotulo).toBe("Propostas enviadas");
  });

  /**
   * Mês sem varredura registrada não é mês de zero edital publicado: é mês sem
   * a informação. Somar como zero rebaixaria o denominador e inflaria a
   * aderência.
   */
  it("um mês sem varredura deixa o total de publicados indisponível", () => {
    const resumo = totaisDoPeriodo([mes(), mes({ publicados: null })]);
    expect(resumo.publicados).toBeNull();
  });

  it("valor ausente num mês deixa o valor da etapa indisponível, sem afetar a contagem", () => {
    const semValor = mes({ valor: { aderentes: null, aprovadas: 1, orcamento: 1, propostas: 1 } });
    const resumo = totaisDoPeriodo([mes(), semValor]);

    expect(resumo.etapas[0]?.valor).toBeNull();
    expect(resumo.etapas[0]?.ticketMedio).toBeNull();
    expect(resumo.etapas[0]?.quantidade).toBe(400);
  });

  it("período vazio não inventa números", () => {
    const resumo = totaisDoPeriodo([]);
    expect(resumo.publicados).toBeNull();
    expect(resumo.etapas.every((e) => e.quantidade === 0 && e.valor === null)).toBe(true);
  });
});

describe("taxa mensal", () => {
  it("é calculada mês a mês, pelos totais de cada mês", () => {
    const serie = taxaMensal(
      [mes({ quantidade: { aderentes: 200, aprovadas: 50, orcamento: 0, propostas: 0 } }),
       mes({ quantidade: { aderentes: 100, aprovadas: 50, orcamento: 0, propostas: 0 } })],
      "aprovadas", "aderentes",
    );
    expect(serie).toEqual([25, 50]);
  });

  /**
   * A média simples das taxas daria 37,5% aqui; o certo é 100/300 = 33,3%.
   * O teste existe para travar essa confusão, que é a mais comum do gênero.
   */
  it("o total do período não é a média das taxas mensais", () => {
    const meses = [
      mes({ quantidade: { aderentes: 200, aprovadas: 50, orcamento: 0, propostas: 0 } }),
      mes({ quantidade: { aderentes: 100, aprovadas: 50, orcamento: 0, propostas: 0 } }),
    ];
    const serie = taxaMensal(meses, "aprovadas", "aderentes");
    const mediaDasTaxas = (serie[0]! + serie[1]!) / 2;
    const resumo = totaisDoPeriodo(meses);
    const taxaDoPeriodo = percentual(resumo.etapas[1]!.quantidade, resumo.etapas[0]!.quantidade);

    expect(mediaDasTaxas).toBe(37.5);
    expect(taxaDoPeriodo).toBeCloseTo(33.33, 2);
  });

  it("mês sem base devolve nulo naquele mês, sem derrubar a série", () => {
    const serie = taxaMensal(
      [mes({ quantidade: { aderentes: 0, aprovadas: 0, orcamento: 0, propostas: 0 } }), mes()],
      "aprovadas", "aderentes",
    );
    expect(serie[0]).toBeNull();
    expect(serie[1]).toBe(25);
  });
});
