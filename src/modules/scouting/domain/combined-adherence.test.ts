import { describe, expect, it } from "vitest";

import type { Adherence } from "@/modules/scouting/domain/adherence";
import type { ArchiveAdherence } from "@/modules/scouting/domain/archive-adherence";
import { combineAdherence } from "@/modules/scouting/domain/combined-adherence";

const profile = (score: number, undetermined = false): Adherence => ({
  score, undetermined, reasons: [], workTypes: [],
});

const archive = (score: number, determined = true): ArchiveAdherence => ({
  score, determined, requirementInferred: false, required: [], missing: [], unreadable: [],
  needsPartner: false, scale: "UNKNOWN", reasons: [],
});

describe("aderência combinada", () => {
  it("perfil 100% e acervo 100% dá 100%", () => {
    expect(combineAdherence(profile(100), archive(100)).score).toBe(100);
  });

  /**
   * O caso relatado: perfil bate tudo (tipo, valor, prazo, esfera), mas o
   * acervo não sustenta — o número não pode continuar dizendo 100%.
   */
  it("perfil 100% e acervo 0% não é mais 100%", () => {
    const resultado = combineAdherence(profile(100), archive(0));
    expect(resultado.score).toBe(50);
    expect(resultado.determined).toBe(true);
  });

  it("perfil 80% e acervo 60% pesam igual", () => {
    expect(combineAdherence(profile(80), archive(60)).score).toBe(70);
  });

  /**
   * Sem acervo julgado (sem tipo reconhecido, ou sem nada cadastrado), a
   * conta não pode fingir estar completa: nunca fecha 100, e o desfecho diz
   * "não determinado".
   */
  it("acervo não julgado nunca fecha 100, mesmo com perfil perfeito", () => {
    const resultado = combineAdherence(profile(100), archive(0, false));
    expect(resultado.score).toBeLessThan(100);
    expect(resultado.determined).toBe(false);
  });

  it("acervo não julgado vale só a metade do perfil", () => {
    expect(combineAdherence(profile(80), archive(0, false)).score).toBe(40);
  });

  it("perfil não determinado conta como zero, não quebra a conta", () => {
    const resultado = combineAdherence(profile(0, true), archive(100));
    expect(resultado.score).toBe(50);
  });
});
