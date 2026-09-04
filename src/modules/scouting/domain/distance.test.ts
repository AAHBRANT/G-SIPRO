import { describe, expect, it } from "vitest";

import { coordenadaDoMunicipio, haversineKm, nearestBase, type BaseOperacional } from "@/modules/scouting/domain/distance";

describe("coordenada do município", () => {
  /** O caso real que motivou este módulo: Concorrência 17/2026. */
  it("acha Pedra Preta/MT", () => {
    const c = coordenadaDoMunicipio("Pedra Preta", "MT");
    expect(c).toBeDefined();
    expect(c?.lat).toBeCloseTo(-16.62, 1);
    expect(c?.lng).toBeCloseTo(-54.47, 1);
  });

  it("ignora acento e caixa", () => {
    expect(coordenadaDoMunicipio("PEDRA PRETA", "mt")).toEqual(coordenadaDoMunicipio("Pedra Preta", "MT"));
    expect(coordenadaDoMunicipio("São Paulo", "SP")).toBeDefined();
  });

  /** Nomes repetidos em UFs diferentes não podem se confundir. */
  it("mesmo nome em UF diferente é município diferente", () => {
    const rs = coordenadaDoMunicipio("Bom Jesus", "RS");
    const pi = coordenadaDoMunicipio("Bom Jesus", "PI");
    expect(rs).toBeDefined();
    expect(pi).toBeDefined();
    expect(rs).not.toEqual(pi);
  });

  it("sem cidade, sem UF, ou município que o IBGE não lista devolve undefined", () => {
    expect(coordenadaDoMunicipio(undefined, "MT")).toBeUndefined();
    expect(coordenadaDoMunicipio("Pedra Preta", undefined)).toBeUndefined();
    expect(coordenadaDoMunicipio("Cidade Que Nao Existe De Jeito Nenhum", "MT")).toBeUndefined();
  });
});

describe("haversine", () => {
  it("distância de um ponto a ele mesmo é zero", () => {
    expect(haversineKm({ lat: -16.6245, lng: -54.4722 }, { lat: -16.6245, lng: -54.4722 })).toBe(0);
  });

  /**
   * Cuiabá–São Paulo, conferido por uma segunda conta (aproximação planar:
   * graus de latitude e de longitude — já corrigida pelo cosseno da latitude
   * — como catetos de um triângulo retângulo). As duas contas batem em
   * ≈1.328 km, então é a referência usada aqui — não um número de memória.
   */
  it("bate com a distância em linha reta, conferida por uma segunda conta", () => {
    const cuiaba = { lat: -15.6014, lng: -56.0979 };
    const saoPaulo = { lat: -23.5505, lng: -46.6333 };
    const km = haversineKm(cuiaba, saoPaulo);
    expect(km).toBeGreaterThan(1328 * 0.95);
    expect(km).toBeLessThan(1328 * 1.05);
  });

  it("é simétrica", () => {
    const a = { lat: -16.6245, lng: -54.4722 };
    const b = { lat: -15.6014, lng: -56.0979 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
});

describe("base mais próxima", () => {
  const bases: readonly BaseOperacional[] = [
    { id: "b1", name: "Base Cuiabá", lat: -15.6014, lng: -56.0979 },
    { id: "b2", name: "Base São Paulo", lat: -23.5505, lng: -46.6333 },
  ];

  it("escolhe a mais perto, não a primeira da lista", () => {
    const pedraPreta = { lat: -16.6245, lng: -54.4722 };
    const r = nearestBase(pedraPreta, bases);
    expect(r?.base.id).toBe("b1");
    expect(r?.distanceKm).toBeGreaterThan(0);
  });

  it("sem localização ou sem base cadastrada, não calcula — não vira zero", () => {
    expect(nearestBase(undefined, bases)).toBeUndefined();
    expect(nearestBase({ lat: -16.6, lng: -54.4 }, [])).toBeUndefined();
  });
});
