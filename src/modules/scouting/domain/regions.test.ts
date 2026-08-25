import { describe, expect, it } from "vitest";

import { regionOf, regions, statesOf, statesOfRegions } from "@/modules/scouting/domain/regions";

describe("regiões", () => {
  it("cobre as 27 unidades federativas, sem repetir nenhuma", () => {
    const todas = regions.flatMap((region) => statesOf(region));
    expect(todas).toHaveLength(27);
    expect(new Set(todas).size).toBe(27);
  });

  it("encontra a região da unidade federativa", () => {
    expect(regionOf("CE")).toBe("Nordeste");
    expect(regionOf("rs")).toBe("Sul");
    expect(regionOf("DF")).toBe("Centro-Oeste");
  });

  it("não inventa região para valor desconhecido ou ausente", () => {
    expect(regionOf("XX")).toBeUndefined();
    expect(regionOf(null)).toBeUndefined();
  });

  it("expande as regiões selecionadas nas respectivas unidades federativas", () => {
    const estados = statesOfRegions(["Sul", "Centro-Oeste"]);
    expect(estados).toContain("PR");
    expect(estados).toContain("MT");
    expect(estados).not.toContain("CE");
  });

  it("ignora região inexistente em vez de quebrar a consulta", () => {
    expect(statesOfRegions(["Nordeste", "Atlântida"])).toEqual(statesOf("Nordeste"));
  });
});
