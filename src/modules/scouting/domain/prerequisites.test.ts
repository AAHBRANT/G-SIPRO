import { describe, expect, it } from "vitest";

import type { ArchiveAdherence } from "@/modules/scouting/domain/archive-adherence";
import { buildPrerequisites, summarize, type PrerequisiteInput } from "@/modules/scouting/domain/prerequisites";

const acervo = (parcial: Partial<ArchiveAdherence> = {}): ArchiveAdherence => ({
  score: 100, determined: true, requirementInferred: true,
  required: [{ categoryId: "obra-de-arte", label: "Obra de arte especial", covered: true, evidenceCount: 2, examples: [] }],
  missing: [], needsPartner: false, scale: "COVERED", largestExecuted: 62_000_000, reasons: [],
  ...parcial,
});

const entrada = (parcial: Partial<PrerequisiteInput> = {}): PrerequisiteInput => ({
  archive: acervo(),
  daysToClose: 30,
  minimumDays: 10,
  estimatedValue: 40_000_000,
  valueUndisclosed: false,
  minimumValue: 14_000_000,
  ...parcial,
});

const acha = (lista: ReturnType<typeof buildPrerequisites>, id: string) => lista.find((p) => p.id === id);

describe("o que o sistema checa sozinho", () => {
  it("marca acervo como atendido quando não falta serviço", () => {
    const p = acha(buildPrerequisites(entrada()), "acervo");
    expect(p?.status).toBe("MET");
    expect(p?.source).toBe("SISTEMA");
  });

  it("marca acervo como não atendido e diz o que falta", () => {
    const faltando = acervo({
      missing: [{ categoryId: "tunel", label: "Obra de arte especial", covered: false, evidenceCount: 0, examples: [] }],
      needsPartner: true,
    });
    const p = acha(buildPrerequisites(entrada({ archive: faltando })), "acervo");
    expect(p?.status).toBe("NOT_MET");
    expect(p?.detail).toContain("falta obra de arte especial");
  });

  /**
   * Acervo não julgado não é acervo reprovado. Marcar "não atende" aqui faria a
   * equipe descartar obra que sabe fazer.
   */
  it("deixa acervo como desconhecido quando não deu para julgar", () => {
    const p = acha(buildPrerequisites(entrada({ archive: acervo({ determined: false, reasons: ["nenhum acervo cadastrado para confrontar"] }) })), "acervo");
    expect(p?.status).toBe("UNKNOWN");
    expect(p?.detail).toContain("nenhum acervo");
  });

  it("porte insuficiente é atenção, não reprovação: consórcio resolve", () => {
    const p = acha(buildPrerequisites(entrada({ archive: acervo({ scale: "BELOW", largestExecuted: 20_000_000 }) })), "porte");
    expect(p?.status).toBe("ATTENTION");
    expect(p?.detail).toContain("consórcio");
  });

  it.each([
    [30, "MET"],
    [4, "ATTENTION"],
    [-1, "NOT_MET"],
  ])("prazo de %s dia(s) resulta em %s", (dias, esperado) => {
    expect(acha(buildPrerequisites(entrada({ daysToClose: dias })), "prazo")?.status).toBe(esperado);
  });

  it("valor abaixo do piso reprova, e diz os dois números", () => {
    const p = acha(buildPrerequisites(entrada({ estimatedValue: 4_000_000 })), "valor");
    expect(p?.status).toBe("NOT_MET");
    expect(p?.detail).toContain("abaixo do piso");
  });

  /** Sigiloso é comum em obra grande: tratar como reprovação eliminaria o alvo. */
  it("valor sigiloso não reprova", () => {
    const p = acha(buildPrerequisites(entrada({ valueUndisclosed: true, estimatedValue: undefined })), "valor");
    expect(p?.status).toBe("UNKNOWN");
    expect(p?.detail).toContain("não é motivo para descartar");
  });
});

describe("o que só o edital responde", () => {
  /**
   * O ponto que a lista existe para deixar claro: sem leitura do edital, estes
   * itens aparecem PENDENTES, nunca atendidos. Marcar como atendido o que
   * ninguém verificou faz a equipe montar proposta e ser inabilitada.
   */
  it("sem leitura do edital, os itens dele ficam pendentes e identificados", () => {
    const lista = buildPrerequisites(entrada());
    for (const id of ["consorcio", "cat", "visita", "garantia"]) {
      const p = acha(lista, id);
      expect(p?.status).toBe("UNKNOWN");
      expect(p?.source).toBe("EDITAL");
      expect(p?.detail).toContain("leitura automática ainda não habilitada");
    }
  });

  it("com o edital lido, responde consórcio, CAT e visita", () => {
    const lista = buildPrerequisites(entrada({
      edital: { services: [], consortiumAllowed: true, requiresCat: true, requiresSiteVisit: false, limitations: [] },
    }));
    expect(acha(lista, "consorcio")?.status).toBe("MET");
    expect(acha(lista, "cat")?.status).toBe("ATTENTION");
    expect(acha(lista, "visita")?.status).toBe("MET");
  });

  /**
   * Edital que veda consórcio numa licitação em que falta acervo é reprovação,
   * não aviso: não há como suprir a falta.
   */
  it("consórcio vedado reprova quando o acervo depende de parceiro", () => {
    const semParceiro = { services: [], consortiumAllowed: false, limitations: [] };
    const comFalta = acervo({ needsPartner: true, missing: [{ categoryId: "x", label: "Túnel", covered: false, evidenceCount: 0, examples: [] }] });

    expect(acha(buildPrerequisites(entrada({ edital: semParceiro, archive: comFalta })), "consorcio")?.status).toBe("NOT_MET");
    // Sem depender de parceiro, vedar consórcio é só um aviso.
    expect(acha(buildPrerequisites(entrada({ edital: semParceiro })), "consorcio")?.status).toBe("ATTENTION");
  });

  it("ponto que a leitura não achou fica desconhecido, e não atendido", () => {
    const lista = buildPrerequisites(entrada({ edital: { services: [], limitations: [] } }));
    expect(acha(lista, "consorcio")?.status).toBe("UNKNOWN");
    expect(acha(lista, "consorcio")?.detail).toContain("não foi encontrado");
  });

  it("mostra o que a leitura não conseguiu determinar", () => {
    const lista = buildPrerequisites(entrada({
      edital: { services: [], limitations: ["capital mínimo não localizado"], consortiumAllowed: true },
    }));
    expect(acha(lista, "leitura")?.detail).toContain("capital mínimo");
  });
});

describe("summarize", () => {
  it("conta cada estado, para a linha da fila resumir sem abrir", () => {
    const resumo = summarize(buildPrerequisites(entrada()));
    expect(resumo.total).toBe(resumo.met + resumo.notMet + resumo.attention + resumo.unknown);
    expect(resumo.met).toBeGreaterThan(0);
    // Os quatro do edital seguem pendentes enquanto ninguém lê.
    expect(resumo.unknown).toBeGreaterThanOrEqual(4);
  });
});
