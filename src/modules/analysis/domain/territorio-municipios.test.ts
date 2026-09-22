import { describe, expect, it } from "vitest";

import { UNIDADES_FEDERATIVAS, type UnidadeFederativa } from "@/modules/analysis/domain/malha-uf";
import { acharMunicipio, totalDeMunicipios } from "@/modules/analysis/infrastructure/municipios-brasil";
import {
  chaveDaCelula,
  filtrar,
  filtrarRegistros,
  nomesDeMunicipios,
  porMunicipio,
  projetar,
  resumosRegionais,
  semMunicipio,
  total,
  ultimaEtapa,
  type CelulaTerritorial,
  type LicitacaoDoRecorte,
} from "@/modules/analysis/domain/territorio";

const celula = (uf: string | null, cidade: string | null, n: number, valor: number | null = null): CelulaTerritorial => ({
  mes: "2026-09-01",
  uf,
  cidade,
  esfera: "M",
  quantidade: { aderentes: n, aprovadas: 0, orcamento: 0, propostas: 0 },
  valor: { aderentes: valor, aprovadas: null, orcamento: null, propostas: null },
  semValor: 0,
});

const registro = (parcial: Partial<LicitacaoDoRecorte> = {}): LicitacaoDoRecorte => ({
  id: "1",
  identificador: "00000000000000-1-000001/2026",
  objeto: "Pavimentação",
  uf: "MG",
  cidade: "Belo Horizonte",
  esfera: "M",
  autoridade: "Prefeitura",
  captadaEm: "2026-09-01T00:00:00.000Z",
  fechaEm: null,
  valor: 1000,
  aprovada: false,
  estudoConcluido: false,
  propostaEnviada: false,
  ...parcial,
});

const CAPITAIS: Record<string, string> = {
  AC: "Rio Branco", AL: "Maceió", AP: "Macapá", AM: "Manaus", BA: "Salvador", CE: "Fortaleza",
  DF: "Brasília", ES: "Vitória", GO: "Goiânia", MA: "São Luís", MT: "Cuiabá", MS: "Campo Grande",
  MG: "Belo Horizonte", PA: "Belém", PB: "João Pessoa", PR: "Curitiba", PE: "Recife", PI: "Teresina",
  RJ: "Rio de Janeiro", RN: "Natal", RS: "Porto Alegre", RO: "Porto Velho", RR: "Boa Vista",
  SC: "Florianópolis", SP: "São Paulo", SE: "Aracaju", TO: "Palmas",
};

describe("base de municípios", () => {
  it("carrega os municípios do país", () => {
    expect(totalDeMunicipios()).toBeGreaterThan(5500);
  });

  it("acha pelo nome como o portal escreve, com acento e caixa qualquer", () => {
    expect(acharMunicipio("São Paulo", "SP")?.ibge).toBe(3550308);
    expect(acharMunicipio("sao paulo", "sp")?.ibge).toBe(3550308);
    expect(acharMunicipio("  Belo Horizonte  ", "MG")?.ibge).toBe(3106200);
  });

  /** Homônimo é resolvido pelo par nome+UF, nunca pelo nome sozinho. */
  it("distingue municípios de mesmo nome em UFs diferentes", () => {
    const rs = acharMunicipio("Bom Jesus", "RS");
    const pi = acharMunicipio("Bom Jesus", "PI");
    expect(rs?.ibge).toBeDefined();
    expect(pi?.ibge).toBeDefined();
    expect(rs?.ibge).not.toBe(pi?.ibge);
  });

  it("nome que não existe devolve indefinido, sem explodir", () => {
    expect(acharMunicipio("Cidade Inventada", "SP")).toBeUndefined();
    expect(acharMunicipio(null, "SP")).toBeUndefined();
    expect(acharMunicipio("São Paulo", null)).toBeUndefined();
  });
});

/**
 * ⚠️ Esta é a prova de que a projeção está calibrada para ESTA malha. Sem
 * ela, um ponto no lugar errado passa despercebido: projeção trocada erra
 * poucos pixels em alguns estados e meio mapa em outros.
 */
describe("projeção geográfica", () => {
  const dentroDoContorno = (x: number, y: number, uf: UnidadeFederativa): boolean => {
    for (const parte of uf.contorno.split("M").slice(1)) {
      const pontos = [...parte.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
      if (pontos.length < 3) continue;
      let dentro = false;
      for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
        const atual = pontos[i];
        const anterior = pontos[j];
        if (!atual || !anterior) continue;
        const [xi, yi] = atual;
        const [xj, yj] = anterior;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) dentro = !dentro;
      }
      if (dentro) return true;
    }
    return false;
  };

  it("a capital de cada estado cai dentro do contorno do próprio estado", () => {
    const fora: string[] = [];
    for (const uf of UNIDADES_FEDERATIVAS) {
      const capital = CAPITAIS[uf.sigla];
      expect(capital, `faltou a capital de ${uf.sigla} na lista do teste`).toBeDefined();
      const municipio = acharMunicipio(capital, uf.sigla);
      expect(municipio, `${capital}/${uf.sigla} não está na base`).toBeDefined();
      if (!municipio) continue;
      const { x, y } = projetar(municipio.latitude, municipio.longitude);
      if (!dentroDoContorno(x, y, uf)) fora.push(`${capital}/${uf.sigla}`);
    }
    expect(fora).toEqual([]);
  });

  it("o extremo oeste do país fica dentro do mapa, não fora dele", () => {
    const { x } = projetar(-7.5, -73.9);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(730);
  });
});

describe("agrupamento por município", () => {
  const celulas = [
    celula("MG", "Belo Horizonte", 5, 1000),
    celula("MG", "belo horizonte", 3, 500),
    celula("MG", "Contagem", 2, 200),
    celula("SP", "São Paulo", 7, 3000),
    celula("MG", null, 4, 100),
  ];

  /** Grafia diferente é o mesmo município, não dois. */
  it("junta a mesma cidade escrita de jeitos diferentes", () => {
    expect(porMunicipio(celulas, "aderentes").get("belo horizonte|MG")?.quantidade).toBe(8);
  });

  it("cidade de UFs diferentes não se mistura", () => {
    expect([...porMunicipio(celulas, "aderentes").keys()].sort()).toEqual([
      "belo horizonte|MG",
      "contagem|MG",
      "sao paulo|SP",
    ]);
  });

  it("guarda o nome legível de cada chave", () => {
    expect(nomesDeMunicipios(celulas).get("sao paulo|SP")).toEqual({ nome: "São Paulo", uf: "SP" });
  });

  it("licitação sem município aparece à parte e continua no total", () => {
    expect(semMunicipio(celulas, "aderentes").quantidade).toBe(4);
    expect(total(celulas, "aderentes").quantidade).toBe(21);
  });

  it("filtra por município", () => {
    expect(total(filtrar(celulas, { municipio: "belo horizonte|MG" }), "aderentes").quantidade).toBe(8);
  });

  it("chave exige cidade e UF", () => {
    expect(chaveDaCelula(celula("MG", null, 1))).toBeNull();
    expect(chaveDaCelula(celula(null, "Contagem", 1))).toBeNull();
  });
});

describe("resumos regionais", () => {
  const celulas = [celula("SP", "São Paulo", 10), celula("RS", "Porto Alegre", 5)];

  /** Região vazia é informação: é onde a empresa não está. */
  it("traz as cinco regiões, inclusive as sem licitação", () => {
    const resumos = resumosRegionais(celulas, "aderentes", "qtd");
    expect(resumos).toHaveLength(5);
    expect(resumos.find((r) => r.regiao === "Norte")?.medida).toBe(0);
    expect(resumos.find((r) => r.regiao === "Sudeste")?.medida).toBe(10);
  });

  it("a participação é sobre o nacional e nunca é NaN", () => {
    const resumos = resumosRegionais(celulas, "aderentes", "qtd");
    expect(resumos.find((r) => r.regiao === "Sul")?.participacao).toBeCloseTo(33.33, 1);
    expect(resumosRegionais([], "aderentes", "qtd").every((r) => r.participacao === null)).toBe(true);
  });
});

describe("última etapa alcançada", () => {
  it("a mais avançada vence", () => {
    expect(ultimaEtapa(registro())).toBe("aderentes");
    expect(ultimaEtapa(registro({ aprovada: true }))).toBe("aprovadas");
    expect(ultimaEtapa(registro({ aprovada: true, estudoConcluido: true }))).toBe("orcamento");
    expect(ultimaEtapa(registro({ aprovada: true, estudoConcluido: true, propostaEnviada: true }))).toBe("propostas");
  });
});

describe("lista de licitações do recorte", () => {
  const registros = [
    registro({ id: "1", uf: "MG", cidade: "Belo Horizonte", esfera: "M" }),
    registro({ id: "2", uf: "SP", cidade: "Campinas", esfera: "F" }),
    registro({ id: "3", uf: "RS", cidade: "Porto Alegre", esfera: "E" }),
  ];

  it("filtra por esfera, região, estado e município", () => {
    expect(filtrarRegistros(registros, { esfera: "F" }).map((r) => r.id)).toEqual(["2"]);
    expect(filtrarRegistros(registros, { regiao: "Sudeste" }).map((r) => r.id)).toEqual(["1", "2"]);
    expect(filtrarRegistros(registros, { uf: "RS" }).map((r) => r.id)).toEqual(["3"]);
    expect(filtrarRegistros(registros, { municipio: "campinas|SP" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("sem filtro devolve tudo", () => {
    expect(filtrarRegistros(registros, {})).toHaveLength(3);
  });
});
