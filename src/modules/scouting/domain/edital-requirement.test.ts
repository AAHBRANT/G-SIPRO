import { describe, expect, it } from "vitest";

import { parseBoolean, parseEditalRequirement, toArchiveRequirement } from "@/modules/scouting/domain/edital-requirement";

const campo = (field: string, value: string) => ({ field, value });
const parcelas = (value: string) => [campo("Parcelas de maior relevância e quantitativos mínimos", value)];

describe("parcelas em tabela", () => {
  it("lê descrição, quantidade e unidade", () => {
    const lido = parseEditalRequirement(parcelas(JSON.stringify([
      { servico: "Ponte em concreto armado", quantidade: "15", unidade: "m" },
      { descricao: "Pavimentação asfáltica", quantidade: "3.500,50", unidade: "m²" },
    ])));

    expect(lido.services).toEqual([
      { description: "Ponte em concreto armado", quantity: 15, unit: "m" },
      { description: "Pavimentação asfáltica", quantity: 3_500.5, unit: "m²" },
    ]);
  });

  /** Formato brasileiro: ler 1.500 como 1,5 seria errar por mil vezes. */
  it("milhar com ponto não vira decimal", () => {
    const lido = parseEditalRequirement(parcelas(JSON.stringify([{ servico: "Aterro", quantidade: "1.500", unidade: "m3" }])));
    expect(lido.services[0]?.quantity).toBe(1_500);
  });

  it("parcela sem quantitativo continua valendo como exigência", () => {
    const lido = parseEditalRequirement(parcelas(JSON.stringify([{ servico: "Drenagem urbana" }])));
    expect(lido.services).toEqual([{ description: "Drenagem urbana" }]);
  });
});

describe("parcelas em texto corrido", () => {
  /**
   * O caminho que sustenta a regra "acervo de 30 m cobre exigência de 15 m"
   * quando a leitura devolve prosa em vez de tabela.
   */
  it("pesca o quantitativo do meio da frase", () => {
    const lido = parseEditalRequirement(parcelas("Ponte em concreto armado — 15 m\nPavimentação asfáltica de 3.500 m²"));

    expect(lido.services).toEqual([
      { description: "Ponte em concreto armado — 15 m", quantity: 15, unit: "m" },
      { description: "Pavimentação asfáltica de 3.500 m²", quantity: 3_500, unit: "m2" },
    ]);
  });

  /**
   * Número solto não é quantitativo. Em "2 pontes de 15 m", "pontes" não é
   * unidade — pegar o 2 diria à equipe que bastam 2 metros de ponte.
   */
  it("ignora número cuja palavra seguinte não é unidade", () => {
    const lido = parseEditalRequirement(parcelas("2 pontes de 15 m de extensão"));
    expect(lido.services[0]?.quantity).toBe(15);
    expect(lido.services[0]?.unit).toBe("m");
  });

  it("frase sem unidade nenhuma fica sem quantitativo, e não com um chute", () => {
    const lido = parseEditalRequirement(parcelas("Execução de obra de arte especial conforme projeto"));
    expect(lido.services[0]?.quantity).toBeUndefined();
  });

  it("tira marcador de lista e descarta linha curta demais", () => {
    const lido = parseEditalRequirement(parcelas("- Terraplenagem\n1. Drenagem profunda\n\nok"));
    expect(lido.services.map((s) => s.description)).toEqual(["Terraplenagem", "Drenagem profunda"]);
  });
});

describe("parcelas em tabela markdown (a IA devolveu texto, não JSON)", () => {
  /**
   * Achado em produção: o cabeçalho e a linha separadora viravam "serviço" —
   * apareciam na tela como "o sistema não soube classificar", ao lado de
   * linhas de dado que mantinham a formatação de tabela em vez de descrição
   * limpa. Trecho real, como a leitura devolveu.
   */
  const TABELA_REAL = `| Item | Origem | Código | Parcela/serviço | Unidade | Quantitativo mínimo |
|---|---|---|---|---|---:|
| 2 | DER-SP | 72.31.04.04 | Grupo gerador 115KVA Cond. D | hora | 9.504,00 |
| 4 | DER-SP | 24.03.06 | Escoramento de valas/cavas p/fund.cont. | m2 | 7.123,70 |
| 6 | INFRA | 07-010-000 | Fornecimento e aplicação de aço CA-50 | KG | 85.783,76 |`;

  it("não transforma cabeçalho nem linha separadora em serviço", () => {
    const lido = parseEditalRequirement(parcelas(TABELA_REAL));
    expect(lido.services).toHaveLength(3);
    expect(lido.services.some((s) => s.description.includes("|"))).toBe(false);
    expect(lido.services.some((s) => /^item$/i.test(s.description))).toBe(false);
  });

  it("lê descrição, quantidade e unidade pela coluna certa, não pela posição", () => {
    const lido = parseEditalRequirement(parcelas(TABELA_REAL));
    expect(lido.services).toEqual([
      { description: "Grupo gerador 115KVA Cond. D", quantity: 9_504, unit: "hora" },
      { description: "Escoramento de valas/cavas p/fund.cont.", quantity: 7_123.7, unit: "m2" },
      { description: "Fornecimento e aplicação de aço CA-50", quantity: 85_783.76, unit: "KG" },
    ]);
  });

  it("tabela sem coluna de descrição reconhecível cai no fallback de texto corrido", () => {
    const semDescricao = "| Código | Valor |\n|---|---|\n| 1 | 100 |";
    const lido = parseEditalRequirement(parcelas(semDescricao));
    // Nenhuma coluna bate com parcela/serviço/descrição — melhor tratar como
    // texto corrido (aqui, sem linha longa o bastante) do que arriscar coluna errada.
    expect(lido.services).toEqual([]);
  });
});

describe("os pontos de sim ou não", () => {
  it.each([
    ["Permitido", true], ["Será permitida a participação em consórcio", true],
    ["Vedada", false], ["Não será permitido", false], ["Proibido", false],
    ["O edital é omisso", undefined], ["", undefined],
  ])("%s", (texto, esperado) => {
    expect(parseBoolean(texto)).toBe(esperado);
  });

  it("liga cada resposta ao seu campo", () => {
    const lido = parseEditalRequirement([
      campo("Permite consórcio", "Vedada a participação em consórcio"),
      campo("Exige atestado registrado no CREA/CAU (CAT)", "Sim, exigido"),
      campo("Exige visita técnica", "Não"),
    ]);
    expect(lido.consortiumAllowed).toBe(false);
    expect(lido.requiresCat).toBe(true);
    expect(lido.requiresSiteVisit).toBe(false);
  });

  /** Silêncio da leitura ≠ silêncio do edital. Os dois viram "não sei". */
  it("campo ausente fica indefinido", () => {
    const lido = parseEditalRequirement([]);
    expect(lido.consortiumAllowed).toBeUndefined();
    expect(lido.requiresCat).toBeUndefined();
    expect(lido.services).toEqual([]);
  });

  it("carrega confiança e limitações declaradas", () => {
    const lido = parseEditalRequirement([], { confidence: 0.62, limitations: ["anexo IV ilegível"] });
    expect(lido.confidence).toBe(0.62);
    expect(lido.limitations).toEqual(["anexo IV ilegível"]);
  });
});

describe("conversão para o confronto com o acervo", () => {
  it("marca a exigência como lida, e não inferida", () => {
    const requisito = toArchiveRequirement(parseEditalRequirement(parcelas(JSON.stringify([
      { servico: "Ponte em concreto armado", quantidade: "15", unidade: "m" },
    ]))), 40_000_000);

    expect(requisito?.inferred).toBe(false);
    expect(requisito?.estimatedValue).toBe(40_000_000);
    expect(requisito?.sources[0]).toEqual({ text: "Ponte em concreto armado", quantity: { value: 15, unit: "m" } });
  });

  /**
   * Requisito vazio daria 100% de cobertura para qualquer empresa — pareceria
   * certeza justamente onde não se leu nada.
   */
  it("leitura sem parcela nenhuma não vira requisito", () => {
    expect(toArchiveRequirement(parseEditalRequirement([]))).toBeNull();
  });

  it("unidade que não se compara por número não viaja como quantitativo", () => {
    const requisito = toArchiveRequirement(parseEditalRequirement(parcelas(JSON.stringify([
      { servico: "Sinalização viária", quantidade: "1", unidade: "verba" },
    ]))));
    expect(requisito?.sources[0]).toEqual({ text: "Sinalização viária" });
  });
});
