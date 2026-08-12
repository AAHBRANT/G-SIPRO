import { describe, expect, it } from "vitest";

import { daysUntil, detectWorkTypes, flaggedConditions, normalizeText, qualify, type CandidateTender } from "@/modules/scouting/domain/qualification";
import { defaultScoutFilter, scoutFilterSchema, type ScoutFilter } from "@/modules/scouting/domain/scout-filter";

const reference = new Date("2026-07-28T12:00:00.000Z");

function buildFilter(overrides: Partial<ScoutFilter> = {}): ScoutFilter {
  return scoutFilterSchema.parse({ ...defaultScoutFilter, ...overrides });
}

function buildCandidate(overrides: Partial<CandidateTender> = {}): CandidateTender {
  return {
    externalId: "PNCP-1",
    subject: "Contratação de empresa para execução de obra de pavimentação da rodovia CE-363",
    authorityName: "Estado do Ceará",
    sphere: "E",
    state: "CE",
    estimatedValue: 30_000_000,
    valueUndisclosed: false,
    proposalClosesAt: new Date("2026-08-28T12:00:00.000Z"),
    ...overrides,
  };
}

describe("normalizeText", () => {
  it("remove acentuação e normaliza espaços", () => {
    expect(normalizeText("  Construção   de PAVIMENTAÇÃO ")).toBe("construcao de pavimentacao");
  });
});

describe("detectWorkTypes", () => {
  it("identifica pavimentação em objeto de rodovia", () => {
    expect(detectWorkTypes("Pavimentação da rodovia CE-350")).toContain("PAVING");
  });

  it("identifica obra de arte especial em objeto de ponte", () => {
    expect(detectWorkTypes("Construção de ponte de concreto armado")).toContain("SPECIAL_STRUCTURE");
  });

  it("reconhece mais de um tipo no mesmo objeto", () => {
    const types = detectWorkTypes("Reforma e ampliação da escola municipal");
    expect(types).toContain("RENOVATION");
    expect(types).toContain("BUILDING");
  });

  it("devolve lista vazia quando o objeto não é obra", () => {
    expect(detectWorkTypes("Aquisição de material de expediente")).toHaveLength(0);
  });
});

describe("daysUntil", () => {
  it("conta os dias inteiros até a data alvo", () => {
    expect(daysUntil(new Date("2026-08-07T12:00:00.000Z"), reference)).toBe(10);
  });
});

describe("qualify", () => {
  it("aprova licitação dentro do perfil", () => {
    const result = qualify(buildCandidate(), buildFilter(), reference);
    expect(result.qualified).toBe(true);
  });

  it("recusa esfera fora da configuração", () => {
    const result = qualify(buildCandidate({ sphere: "M" }), buildFilter({ spheres: ["E"] }), reference);
    expect(result).toEqual({ qualified: false, reason: "SPHERE" });
  });

  it("recusa unidade federativa fora da configuração", () => {
    const result = qualify(buildCandidate({ state: "SP" }), buildFilter({ states: ["CE", "RN"] }), reference);
    expect(result).toEqual({ qualified: false, reason: "STATE" });
  });

  it("não restringe a unidade federativa quando nenhuma foi escolhida", () => {
    const result = qualify(buildCandidate({ state: "SP" }), buildFilter({ states: [] }), reference);
    expect(result.qualified).toBe(true);
  });

  it("recusa objeto que contém termo excluído", () => {
    const candidate = buildCandidate({ subject: "Contratação de mão de obra para pavimentação" });
    const result = qualify(candidate, buildFilter(), reference);
    expect(result).toEqual({ qualified: false, reason: "EXCLUDED_KEYWORD" });
  });

  it("recusa objeto sem nenhum termo de inclusão", () => {
    const candidate = buildCandidate({ subject: "Aquisição de gêneros alimentícios para merenda" });
    const result = qualify(candidate, buildFilter(), reference);
    expect(result).toEqual({ qualified: false, reason: "NO_INCLUDED_KEYWORD" });
  });

  it("recusa tipo de obra fora dos ramos configurados", () => {
    const candidate = buildCandidate({ subject: "Execução de obra de saneamento e esgotamento sanitário" });
    const result = qualify(candidate, buildFilter({ workTypes: ["BUILDING"] }), reference);
    expect(result).toEqual({ qualified: false, reason: "WORK_TYPE" });
  });

  it("recusa valor abaixo do mínimo", () => {
    const result = qualify(buildCandidate({ estimatedValue: 100_000 }), buildFilter({ minimumValue: 500_000 }), reference);
    expect(result).toEqual({ qualified: false, reason: "MINIMUM_VALUE" });
  });

  it("recusa valor acima do máximo", () => {
    const result = qualify(buildCandidate({ estimatedValue: 90_000_000 }), buildFilter({ maximumValue: 40_000_000 }), reference);
    expect(result).toEqual({ qualified: false, reason: "MAXIMUM_VALUE" });
  });

  it("mantém licitação de valor sigiloso quando a equipe aceita sigilo", () => {
    const candidate = buildCandidate({ estimatedValue: undefined, valueUndisclosed: true });
    const result = qualify(candidate, buildFilter({ minimumValue: 500_000, includeUndisclosedValue: true }), reference);
    expect(result.qualified).toBe(true);
  });

  it("recusa valor sigiloso quando a equipe não aceita sigilo", () => {
    const candidate = buildCandidate({ estimatedValue: undefined, valueUndisclosed: true });
    const result = qualify(candidate, buildFilter({ includeUndisclosedValue: false }), reference);
    expect(result).toEqual({ qualified: false, reason: "UNDISCLOSED_VALUE" });
  });

  it("recusa prazo menor que o mínimo para montar proposta", () => {
    const candidate = buildCandidate({ proposalClosesAt: new Date("2026-07-30T12:00:00.000Z") });
    const result = qualify(candidate, buildFilter({ minimumDaysToClose: 10 }), reference);
    expect(result).toEqual({ qualified: false, reason: "DEADLINE" });
  });

  it("recusa licitação sem data de encerramento", () => {
    const result = qualify(buildCandidate({ proposalClosesAt: undefined }), buildFilter(), reference);
    expect(result).toEqual({ qualified: false, reason: "DEADLINE" });
  });
});

describe("flaggedConditions", () => {
  it("lista apenas as condições marcadas para sinalizar", () => {
    const conditions = flaggedConditions(buildFilter());
    expect(conditions).toContain("IN_PERSON_SESSION");
    expect(conditions).not.toContain("CONSORTIUM_FORBIDDEN");
  });
});

describe("configuração inicial", () => {
  it("não descarta nenhuma condição automaticamente", () => {
    const treatments = Object.values(defaultScoutFilter.conditionTreatments);
    expect(treatments).not.toContain("DISCARD");
  });

  it("recusa obra abaixo de R$ 14 milhões", () => {
    const result = qualify(buildCandidate({ estimatedValue: 13_999_999 }), buildFilter(), reference);
    expect(result).toEqual({ qualified: false, reason: "MINIMUM_VALUE" });
  });

  it("aceita obra a partir de R$ 14 milhões", () => {
    expect(qualify(buildCandidate({ estimatedValue: 14_000_000 }), buildFilter(), reference).qualified).toBe(true);
  });

  it("aceita valor sigiloso mesmo com piso de R$ 14 milhões, porque obra grande costuma ter orçamento fechado", () => {
    const candidate = buildCandidate({ estimatedValue: undefined, valueUndisclosed: true });
    expect(qualify(candidate, buildFilter(), reference).qualified).toBe(true);
  });
});
