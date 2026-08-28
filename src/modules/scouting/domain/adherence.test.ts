import { describe, expect, it } from "vitest";

import { computeAdherence, resolveWorkTypes, type AdherenceInput } from "@/modules/scouting/domain/adherence";
import { defaultScoutFilter } from "@/modules/scouting/domain/scout-filter";

const reference = new Date("2026-08-28T12:00:00.000Z");

const base: AdherenceInput = {
  subject: "Construção do novo prédio da EMEI São Jorge",
  sphere: "M",
  workTypes: ["BUILDING"],
  estimatedValue: 30_000_000,
  valueUndisclosed: false,
  proposalClosesAt: new Date("2026-10-01T12:00:00.000Z"),
};

const reasonFor = (input: AdherenceInput, criterion: string) =>
  computeAdherence(input, defaultScoutFilter, reference).reasons.find((reason) => reason.criterion === criterion);

describe("computeAdherence", () => {
  it("dá nota cheia à obra que atende todos os critérios do perfil", () => {
    expect(computeAdherence(base, defaultScoutFilter, reference).score).toBe(100);
  });

  it("derruba a nota da obra abaixo do piso de R$ 14 mi", () => {
    // O caso real que apareceu no topo da fila em 28/08/2026: R$ 4,3 mi.
    const adherence = computeAdherence({ ...base, estimatedValue: 4_333_008 }, defaultScoutFilter, reference);
    expect(adherence.score).toBeLessThan(100);
    expect(reasonFor({ ...base, estimatedValue: 4_333_008 }, "VALUE")).toMatchObject({ met: false, skipped: false });
  });

  it("não penaliza nem premia valor sigiloso: tira o critério da conta", () => {
    const undisclosed = { ...base, estimatedValue: undefined, valueUndisclosed: true };
    // Todos os demais critérios atendidos, então a nota continua cheia — mas
    // sobre os critérios que puderam ser julgados, não sobre um palpite.
    expect(computeAdherence(undisclosed, defaultScoutFilter, reference).score).toBe(100);
    expect(reasonFor(undisclosed, "VALUE")).toMatchObject({ skipped: true, met: false });
  });

  it("distingue sigiloso de zerado: o sigiloso não vira nota pior que o do valor conhecido", () => {
    const undisclosed = computeAdherence({ ...base, estimatedValue: undefined, valueUndisclosed: true }, defaultScoutFilter, reference);
    const belowFloor = computeAdherence({ ...base, estimatedValue: 1_000 }, defaultScoutFilter, reference);
    expect(undisclosed.score).toBeGreaterThan(belowFloor.score);
  });

  it("marca a licitação que encerra ainda hoje e derruba a nota", () => {
    // Fecha mais tarde no mesmo dia da referência: ainda aberta, mas sem prazo útil.
    const closed = { ...base, proposalClosesAt: new Date("2026-08-28T23:00:00.000Z") };
    expect(reasonFor(closed, "DEADLINE")).toMatchObject({ met: false, skipped: false, label: "encerra hoje" });
    expect(computeAdherence(closed, defaultScoutFilter, reference).score).toBeLessThan(100);
  });

  it("marca prazo já vencido como encerrado", () => {
    const expired = { ...base, proposalClosesAt: new Date("2026-08-20T12:00:00.000Z") };
    expect(reasonFor(expired, "DEADLINE")?.label).toBe("prazo encerrado");
  });

  it("reconhece tipo de obra fora dos ramos da empresa", () => {
    const outside = { ...base, subject: "Execução de poço tubular profundo", workTypes: ["SANITATION"] };
    expect(reasonFor(outside, "WORK_TYPE")).toMatchObject({ met: false });
  });

  it("entrega motivo para cada critério, para a linha poder explicar a nota", () => {
    const { reasons } = computeAdherence(base, defaultScoutFilter, reference);
    expect(reasons.map((reason) => reason.criterion)).toEqual(["WORK_TYPE", "VALUE", "DEADLINE", "SPHERE"]);
    expect(reasons.every((reason) => reason.label.length > 0)).toBe(true);
  });
});

describe("resolveWorkTypes", () => {
  it("usa o que está gravado quando existe", () => {
    expect(resolveWorkTypes({ ...base, workTypes: ["PAVING"] })).toEqual(["PAVING"]);
  });

  /**
   * Registros capturados antes da migração de 12/08/2026 têm `workTypes` vazio.
   * Sem esta reserva eles aparecem sem etiqueta e somem do filtro por tipo de
   * obra — foi o que apareceu no print de 28/08.
   */
  it("lê o objeto quando a coluna está vazia, para não deixar a fila antiga sem etiqueta", () => {
    expect(resolveWorkTypes({ ...base, workTypes: [] })).toEqual(["BUILDING"]);
    expect(resolveWorkTypes({ ...base, workTypes: undefined })).toEqual(["BUILDING"]);
  });

  it("descarta valor gravado que não é tipo de obra conhecido", () => {
    expect(resolveWorkTypes({ ...base, workTypes: ["LIXO"] })).toEqual(["BUILDING"]);
  });
});
