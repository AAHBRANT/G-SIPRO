import { describe, expect, it } from "vitest";

import { descartesDaFila, type FilaInput } from "@/modules/scouting/domain/duplicates";
import { planejarLimpeza, type LicitacaoParaLimpeza, type OportunidadeParaLimpeza } from "@/modules/scouting/domain/limpeza-de-duplicatas";

const OBJETO = "Construção de unidade básica de saúde no bairro Jardim das Flores";

function licitacao(overrides: Partial<LicitacaoParaLimpeza> & { id: string }): LicitacaoParaLimpeza {
  return {
    aprovada: false,
    authorityName: "Prefeitura de Almirante Tamandaré",
    authorityDocument: "76105675000167",
    processNumber: "2026-000193",
    subject: OBJETO,
    createdAt: new Date("2026-09-01T12:00:00Z"),
    ...overrides,
  };
}

function oportunidade(overrides: Partial<OportunidadeParaLimpeza> & { id: string; code: string }): OportunidadeParaLimpeza {
  return {
    status: "QUALIFICATION",
    origin: "BUSCADOR",
    subject: OBJETO,
    contractingAuthorityId: "orgao-1",
    createdAt: new Date("2026-09-02T12:00:00Z"),
    temProposta: false,
    fichas: 0,
    vinculada: true,
    ...overrides,
  };
}

describe("descartesDaFila", () => {
  it("pendente cuja irmã já foi aprovada sai da fila apontando para a aprovada", () => {
    const itens: FilaInput[] = [
      licitacao({ id: "aprovada", aprovada: true }),
      licitacao({ id: "pendente", createdAt: new Date("2026-09-20T12:00:00Z") }),
    ];
    expect(descartesDaFila(itens).get("pendente")).toEqual({ sobrevivente: "aprovada", jaAprovada: true });
    // Aprovada nunca é descartada por aqui, mesmo sendo a mais antiga.
    expect(descartesDaFila(itens).has("aprovada")).toBe(false);
  });

  it("sem aprovada no grupo, mantém a regra antiga: fica a mais recente", () => {
    const itens: FilaInput[] = [
      licitacao({ id: "antiga", publishedAt: new Date("2026-08-01T12:00:00Z") }),
      licitacao({ id: "nova", publishedAt: new Date("2026-09-01T12:00:00Z") }),
    ];
    expect(descartesDaFila(itens).get("antiga")).toEqual({ sobrevivente: "nova", jaAprovada: false });
    expect(descartesDaFila(itens).has("nova")).toBe(false);
  });

  it("obras diferentes do mesmo órgão não se misturam", () => {
    const itens: FilaInput[] = [
      licitacao({ id: "a", aprovada: true }),
      licitacao({ id: "b", processNumber: "2026-000777", subject: "Pavimentação asfáltica da Rua das Palmeiras e adjacências" }),
    ];
    expect(descartesDaFila(itens).size).toBe(0);
  });
});

describe("planejarLimpeza", () => {
  it("duas publicações da mesma obra, cada uma aprovada: encerra a que avançou menos", () => {
    const plano = planejarLimpeza(
      [
        licitacao({ id: "l1", aprovada: true, opportunityId: "o1" }),
        licitacao({ id: "l2", aprovada: true, opportunityId: "o2", processNumber: "2026-000197" }),
      ],
      [
        oportunidade({ id: "o1", code: "OPP-0193/2026", fichas: 1 }),
        oportunidade({ id: "o2", code: "OPP-0197/2026" }),
      ],
    );
    expect(plano.grupos).toHaveLength(1);
    expect(plano.grupos[0]!.fica.id).toBe("o1");
    expect(plano.grupos[0]!.encerrar.map((o) => o.id)).toEqual(["o2"]);
  });

  it("a mesma licitação aprovada duas vezes: a órfã é encerrada, a vinculada fica", () => {
    const plano = planejarLimpeza(
      [licitacao({ id: "l1", aprovada: true, opportunityId: "vinculada" })],
      [
        oportunidade({ id: "orfa", code: "OPP-0010/2026", vinculada: false, createdAt: new Date("2026-09-01T12:00:00Z") }),
        oportunidade({ id: "vinculada", code: "OPP-0011/2026", fichas: 1 }),
      ],
    );
    expect(plano.grupos).toHaveLength(1);
    expect(plano.grupos[0]!.fica.id).toBe("vinculada");
    expect(plano.grupos[0]!.encerrar.map((o) => o.id)).toEqual(["orfa"]);
  });

  it("duplicata que já tem proposta ou avançou não é encerrada sozinha: vai para decisão manual", () => {
    const plano = planejarLimpeza(
      [
        licitacao({ id: "l1", aprovada: true, opportunityId: "o1" }),
        licitacao({ id: "l2", aprovada: true, opportunityId: "o2" }),
      ],
      [
        oportunidade({ id: "o1", code: "OPP-0001/2026", status: "ACTIVE", temProposta: true }),
        oportunidade({ id: "o2", code: "OPP-0002/2026", status: "ACTIVE", temProposta: true, createdAt: new Date("2026-09-10T12:00:00Z") }),
      ],
    );
    expect(plano.grupos[0]!.fica.id).toBe("o1");
    expect(plano.grupos[0]!.encerrar).toHaveLength(0);
    expect(plano.grupos[0]!.manual.map((o) => o.id)).toEqual(["o2"]);
  });

  it("não toca em oportunidade cadastrada à mão nem em encerrada", () => {
    const plano = planejarLimpeza(
      [licitacao({ id: "l1", aprovada: true, opportunityId: "buscador" })],
      [
        oportunidade({ id: "buscador", code: "OPP-0001/2026" }),
        oportunidade({ id: "manual", code: "OPP-0002/2026", origin: "PORTAL", vinculada: false }),
        oportunidade({ id: "fechada", code: "OPP-0003/2026", status: "CLOSED", vinculada: false }),
      ],
    );
    expect(plano.grupos).toHaveLength(0);
  });

  it("órfã sem par (objeto ou órgão diferentes) fica como está", () => {
    const plano = planejarLimpeza(
      [licitacao({ id: "l1", aprovada: true, opportunityId: "o1" })],
      [
        oportunidade({ id: "o1", code: "OPP-0001/2026" }),
        oportunidade({ id: "orfa", code: "OPP-0002/2026", vinculada: false, contractingAuthorityId: "orgao-2" }),
      ],
    );
    expect(plano.grupos).toHaveLength(0);
  });
});
