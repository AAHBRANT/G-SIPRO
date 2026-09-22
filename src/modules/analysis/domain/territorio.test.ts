import { describe, expect, it } from "vitest";

import { UNIDADES_FEDERATIVAS, siglasDaRegiao, ufPorSigla } from "@/modules/analysis/domain/malha-uf";
import {
  ESFERAS,
  NIVEIS_DA_ESCALA,
  distribuicaoPorEsfera,
  esferaConhecida,
  filtrar,
  maximo,
  medidaDe,
  nivelDeCor,
  ordenarRanking,
  participacao,
  pintarPorRegiao,
  porRegiao,
  porUf,
  regioesComDados,
  semLocalizacao,
  tabelaDeAtuacao,
  total,
  type CelulaTerritorial,
} from "@/modules/analysis/domain/territorio";

const celula = (parcial: Partial<CelulaTerritorial> & Pick<CelulaTerritorial, "uf" | "esfera">): CelulaTerritorial => ({
  mes: "2026-09-01",
  cidade: null,
  quantidade: { aderentes: 0, aprovadas: 0, orcamento: 0, propostas: 0 },
  valor: { aderentes: null, aprovadas: null, orcamento: null, propostas: null },
  semValor: 0,
  ...parcial,
});

const comQuantidade = (uf: string | null, esfera: string, aderentes: number, valor: number | null = null, mes = "2026-09-01") =>
  celula({
    uf,
    esfera,
    mes,
    quantidade: { aderentes, aprovadas: 0, orcamento: 0, propostas: 0 },
    valor: { aderentes: valor, aprovadas: null, orcamento: null, propostas: null },
  });

describe("malha das unidades da federação", () => {
  it("tem as 27 unidades", () => {
    expect(UNIDADES_FEDERATIVAS).toHaveLength(27);
  });

  it("toda UF tem contorno desenhável e sigla de duas letras", () => {
    for (const uf of UNIDADES_FEDERATIVAS) {
      expect(uf.sigla).toMatch(/^[A-Z]{2}$/);
      expect(uf.contorno.startsWith("M")).toBe(true);
      expect(uf.contorno.length).toBeGreaterThan(50);
    }
  });

  it("as cinco regiões estão completas", () => {
    expect(siglasDaRegiao("Sul")).toEqual(["PR", "RS", "SC"]);
    expect(siglasDaRegiao("Norte")).toHaveLength(7);
    expect(siglasDaRegiao("Nordeste")).toHaveLength(9);
    expect(siglasDaRegiao("Sudeste")).toHaveLength(4);
    expect(siglasDaRegiao("Centro-Oeste")).toHaveLength(4);
  });

  it("o Distrito Federal é uma UF própria", () => {
    expect(ufPorSigla("DF")?.nome).toContain("Distrito Federal");
  });

  it("aceita sigla em minúscula e recusa o que não existe", () => {
    expect(ufPorSigla("sp")?.sigla).toBe("SP");
    expect(ufPorSigla("XX")).toBeUndefined();
    expect(ufPorSigla(null)).toBeUndefined();
  });
});

describe("esfera", () => {
  it("reconhece as quatro do portal", () => {
    for (const esfera of ESFERAS) expect(esferaConhecida(esfera)).toBe(esfera);
    expect(esferaConhecida("m")).toBe("M");
  });

  /** Classificar errado um órgão distorce mais que deixar de classificar. */
  it("esfera desconhecida não vira Municipal", () => {
    expect(esferaConhecida("X")).toBeNull();
    expect(esferaConhecida("")).toBeNull();
    expect(esferaConhecida(null)).toBeNull();
  });
});

describe("soma territorial", () => {
  it("soma o valor conhecido e ignora o desconhecido", () => {
    const totais = total([comQuantidade("SP", "M", 3, 1000), comQuantidade("SP", "M", 2, null)], "aderentes");
    expect(totais.quantidade).toBe(5);
    expect(totais.valor).toBe(1000);
  });

  /**
   * Diferente do funil de propósito: preservar a ausência apagaria o país
   * inteiro por causa de uma licitação com orçamento sigiloso.
   */
  it("nenhum valor conhecido devolve nulo, não zero", () => {
    expect(total([comQuantidade("SP", "M", 3, null)], "aderentes").valor).toBeNull();
  });

  it("conta as licitações sem valor para a tela poder avisar", () => {
    const base = celula({
      uf: "MG",
      esfera: "E",
      quantidade: { aderentes: 4, aprovadas: 0, orcamento: 0, propostas: 0 },
      valor: { aderentes: 900, aprovadas: null, orcamento: null, propostas: null },
      semValor: 2,
    });
    expect(total([base], "aderentes").semValor).toBe(2);
  });

  it("etapa sem licitação não carrega aviso de valor ausente", () => {
    const base = celula({
      uf: "MG",
      esfera: "E",
      quantidade: { aderentes: 4, aprovadas: 0, orcamento: 0, propostas: 0 },
      valor: { aderentes: 900, aprovadas: null, orcamento: null, propostas: null },
      semValor: 2,
    });
    expect(total([base], "propostas").semValor).toBe(0);
  });
});

describe("agrupamento por UF e região", () => {
  const celulas = [
    comQuantidade("SP", "M", 10, 5000),
    comQuantidade("MG", "M", 4, 2000),
    comQuantidade("RS", "E", 3, 1500),
    comQuantidade(null, "F", 7, 700),
  ];

  it("licitação sem UF não entra em nenhum estado", () => {
    const mapa = porUf(celulas, "aderentes");
    expect([...mapa.keys()].sort()).toEqual(["MG", "RS", "SP"]);
  });

  it("mas continua contando no total e aparece à parte", () => {
    expect(total(celulas, "aderentes").quantidade).toBe(24);
    expect(semLocalizacao(celulas, "aderentes").quantidade).toBe(7);
  });

  it("soma as UFs dentro da região", () => {
    const mapa = porRegiao(celulas, "aderentes");
    expect(mapa.get("Sudeste")?.quantidade).toBe(14);
    expect(mapa.get("Sul")?.quantidade).toBe(3);
    expect(mapa.get("Norte")).toBeUndefined();
  });

  it("no agrupamento regional, toda UF da região recebe o total dela", () => {
    const mapa = pintarPorRegiao(porRegiao(celulas, "aderentes"));
    expect(mapa.get("SP")?.quantidade).toBe(14);
    expect(mapa.get("MG")?.quantidade).toBe(14);
    expect(mapa.get("ES")?.quantidade).toBe(14);
    expect(mapa.get("RS")?.quantidade).toBe(3);
  });

  it("só oferece região que tem dado", () => {
    expect(regioesComDados(celulas)).toEqual(["Sudeste", "Sul"]);
  });
});

describe("filtros", () => {
  const celulas = [
    comQuantidade("SP", "M", 10, null, "2026-08-01"),
    comQuantidade("SP", "F", 2, null, "2026-09-01"),
    comQuantidade("RS", "M", 5, null, "2026-09-01"),
    comQuantidade(null, "M", 9, null, "2026-09-01"),
  ];

  it("filtra por mês", () => {
    expect(total(filtrar(celulas, { meses: new Set(["2026-09-01"]) }), "aderentes").quantidade).toBe(16);
  });

  it("conjunto de meses vazio não filtra nada", () => {
    expect(total(filtrar(celulas, { meses: new Set() }), "aderentes").quantidade).toBe(26);
  });

  it("filtra por esfera", () => {
    expect(total(filtrar(celulas, { esfera: "F" }), "aderentes").quantidade).toBe(2);
  });

  /** Licitação sem UF não pertence a região nenhuma. */
  it("o filtro de região descarta quem não tem UF", () => {
    const sudeste = filtrar(celulas, { regiao: "Sudeste" });
    expect(total(sudeste, "aderentes").quantidade).toBe(12);
    expect(semLocalizacao(sudeste, "aderentes").quantidade).toBe(0);
  });

  it("sem filtro de região, quem não tem UF continua no total", () => {
    expect(semLocalizacao(filtrar(celulas, {}), "aderentes").quantidade).toBe(9);
  });
});

describe("escala de cor do mapa", () => {
  it("o máximo pinta o nível mais escuro e nada pinta o nível vazio", () => {
    expect(nivelDeCor(100, 100)).toBe(NIVEIS_DA_ESCALA);
    expect(nivelDeCor(0, 100)).toBe(0);
  });

  it("valor pequeno mas existente nunca some no nível vazio", () => {
    expect(nivelDeCor(1, 10_000)).toBe(1);
  });

  /** Vazio e indisponível são coisas diferentes, e a tela pinta diferente. */
  it("medida desconhecida é indisponível, não vazio", () => {
    expect(nivelDeCor(null, 100)).toBeNull();
  });

  it("escala sem máximo não inventa nível", () => {
    expect(nivelDeCor(5, 0)).toBeNull();
    expect(nivelDeCor(5, null)).toBeNull();
  });

  it("nunca devolve NaN nem passa do teto", () => {
    expect(nivelDeCor(Number.NaN, 100)).toBeNull();
    expect(nivelDeCor(500, 100)).toBe(NIVEIS_DA_ESCALA);
  });

  it("o máximo ignora o desconhecido", () => {
    const totais = [
      { quantidade: 3, valor: null, semValor: 0 },
      { quantidade: 9, valor: 50, semValor: 0 },
    ];
    expect(maximo(totais, "qtd")).toBe(9);
    expect(maximo(totais, "val")).toBe(50);
    expect(maximo([{ quantidade: 0, valor: null, semValor: 0 }], "val")).toBeNull();
  });
});

describe("participação e ranking", () => {
  it("participação protege divisão por zero", () => {
    expect(participacao(5, 20)).toBe(25);
    expect(participacao(5, 0)).toBeNull();
    expect(participacao(null, 20)).toBeNull();
  });

  /** Num sort ingênuo o desconhecido sobe ao topo e parece o líder. */
  it("o desconhecido vai para o fim do ranking", () => {
    const ordenado = ordenarRanking([
      { chave: "a", rotulo: "A", total: { quantidade: 1, valor: null, semValor: 0 }, medida: null },
      { chave: "b", rotulo: "B", total: { quantidade: 5, valor: null, semValor: 0 }, medida: 5 },
    ]);
    expect(ordenado.map((l) => l.chave)).toEqual(["b", "a"]);
  });

  it("empate desempata por nome", () => {
    const ordenado = ordenarRanking([
      { chave: "z", rotulo: "Zebra", total: { quantidade: 2, valor: null, semValor: 0 }, medida: 2 },
      { chave: "a", rotulo: "Arara", total: { quantidade: 2, valor: null, semValor: 0 }, medida: 2 },
    ]);
    expect(ordenado.map((l) => l.chave)).toEqual(["a", "z"]);
  });
});

describe("cards de esfera", () => {
  const celulas = [comQuantidade("SP", "M", 6), comQuantidade("SP", "F", 2), comQuantidade("RS", "X", 4)];

  it("distribui a etapa entre as quatro esferas", () => {
    const fatias = distribuicaoPorEsfera(celulas, "aderentes", "qtd");
    expect(fatias).toHaveLength(4);
    expect(fatias.find((f) => f.esfera === "M")?.medida).toBe(6);
    expect(fatias.find((f) => f.esfera === "F")?.medida).toBe(2);
    expect(fatias.find((f) => f.esfera === "E")?.medida).toBe(0);
  });

  it("esfera desconhecida fica fora da distribuição", () => {
    const fatias = distribuicaoPorEsfera(celulas, "aderentes", "qtd");
    const soma = fatias.reduce((s, f) => s + (f.medida ?? 0), 0);
    expect(soma).toBe(8);
  });

  it("o percentual é sobre o recorte, e some quando não há base", () => {
    const fatias = distribuicaoPorEsfera(celulas, "aderentes", "qtd");
    expect(fatias.find((f) => f.esfera === "M")?.percentual).toBe(75);
    const vazias = distribuicaoPorEsfera([], "aderentes", "qtd");
    expect(vazias.every((f) => f.percentual === null)).toBe(true);
  });
});

describe("tabela de atuação", () => {
  const celulas = [
    celula({
      uf: "SP",
      esfera: "M",
      quantidade: { aderentes: 10, aprovadas: 6, orcamento: 3, propostas: 2 },
      valor: { aderentes: 1000, aprovadas: 600, orcamento: 300, propostas: 200 },
    }),
    celula({
      uf: "MG",
      esfera: "E",
      quantidade: { aderentes: 4, aprovadas: 1, orcamento: 0, propostas: 0 },
      valor: { aderentes: 400, aprovadas: 100, orcamento: null, propostas: null },
    }),
  ];

  it("traz todas as etapas por UF", () => {
    const linhas = tabelaDeAtuacao(celulas, "uf");
    const sp = linhas.find((l) => l.chave === "SP");
    expect(sp?.etapas.aderentes.quantidade).toBe(10);
    expect(sp?.etapas.propostas.quantidade).toBe(2);
    expect(sp?.rotulo).toContain("São Paulo");
  });

  it("agrupa por região quando pedido", () => {
    const linhas = tabelaDeAtuacao(celulas, "regiao");
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.chave).toBe("Sudeste");
    expect(linhas[0]?.etapas.aderentes.quantidade).toBe(14);
  });
});

describe("medida exibida", () => {
  it("quantidade é sempre conhecida; valor pode não ser", () => {
    const item = { quantidade: 7, valor: null, semValor: 1 };
    expect(medidaDe(item, "qtd")).toBe(7);
    expect(medidaDe(item, "val")).toBeNull();
  });
});
