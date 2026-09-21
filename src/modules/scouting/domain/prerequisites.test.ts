import { describe, expect, it } from "vitest";

import type { ArchiveAdherence } from "@/modules/scouting/domain/archive-adherence";
import { buildPrerequisites, summarize, type PrerequisiteInput } from "@/modules/scouting/domain/prerequisites";

const acervo = (parcial: Partial<ArchiveAdherence> = {}): ArchiveAdherence => ({
  score: 100, determined: true, requirementInferred: true,
  required: [{ categoryId: "obra-de-arte", label: "Obra de arte especial", covered: true, evidenceCount: 2, examples: [] }],
  missing: [], unreadable: [], needsPartner: false, scale: "COVERED", largestExecuted: 62_000_000, reasons: [],
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

  it("com o edital lido, responde consórcio, CAT, visita e garantia de proposta", () => {
    const lista = buildPrerequisites(entrada({
      edital: {
        services: [], consortiumAllowed: true, requiresCat: true, requiresSiteVisit: false,
        requiresProposalBond: true, limitations: [],
      },
    }));
    expect(acha(lista, "consorcio")?.status).toBe("MET");
    expect(acha(lista, "cat")?.status).toBe("ATTENTION");
    expect(acha(lista, "visita")?.status).toBe("MET");
    expect(acha(lista, "garantia")?.status).toBe("ATTENTION");
  });

  it("garantia de proposta não exigida atende", () => {
    const lista = buildPrerequisites(entrada({
      edital: { services: [], requiresProposalBond: false, limitations: [] },
    }));
    expect(acha(lista, "garantia")?.status).toBe("MET");
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

  /**
   * `limitations` não vira item de pré-requisito — lia como ruído cru dentro
   * de um checklist de sim/não (achado 21/09/2026, na tela real), e a mesma
   * lista já aparece no bloco "Parcelas exigidas pelo edital".
   */
  it("o que a leitura não conseguiu determinar não vira item de pré-requisito", () => {
    const lista = buildPrerequisites(entrada({
      edital: { services: [], limitations: ["capital mínimo não localizado"], consortiumAllowed: true },
    }));
    expect(acha(lista, "leitura")).toBeUndefined();
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

describe("parcela que o sistema não soube classificar", () => {
  /**
   * O par do defeito consertado em archive-adherence: cobrir tudo o que se
   * soube ler NÃO é atender, quando sobrou parcela sem conferir. "Atende" aqui
   * faria a equipe montar proposta contando com acervo que ninguém olhou.
   */
  it("acervo vira atenção, e não atendido", () => {
    const p = acha(buildPrerequisites(entrada({ archive: acervo({ unreadable: ["Linha de transmissão 138 kV"] }) })), "acervo");
    expect(p?.status).toBe("ATTENTION");
    // O nome da parcela continua tendo de chegar à pessoa; desde 21/09/2026
    // ele chega pelo desdobramento, e não mais empilhado no `detail` — repetir
    // o mesmo texto nos dois lugares o mostraria duas vezes na mesma tela.
    expect(p?.breakdown?.map((b) => b.label)).toContain("Linha de transmissão 138 kV");
    expect(p?.detail).toContain("não soube classificar");
  });

  it("sem parcela obscura, segue atendido", () => {
    expect(acha(buildPrerequisites(entrada()), "acervo")?.status).toBe("MET");
  });
});

/**
 * "os serviços requeridos ali têm de ser explícitos, e quais a gente atende ou
 * não" — a contagem sozinha não serve para montar consórcio: é o NOME do
 * serviço que falta que vira a conversa com o parceiro.
 */
describe("desdobramento do acervo, serviço a serviço", () => {
  it("nomeia cada serviço exigido e o veredito de cada um", () => {
    const misto = acervo({
      required: [
        { categoryId: "pavimentacao", label: "Pavimentação asfáltica", covered: true, evidenceCount: 3, examples: [] },
        { categoryId: "drenagem", label: "Drenagem urbana", covered: false, evidenceCount: 0, examples: [] },
      ],
      missing: [{ categoryId: "drenagem", label: "Drenagem urbana", covered: false, evidenceCount: 0, examples: [] }],
      needsPartner: true,
    });
    const p = acha(buildPrerequisites(entrada({ archive: misto })), "acervo");

    expect(p?.breakdown?.map((b) => [b.label, b.status])).toEqual([
      ["Pavimentação asfáltica", "MET"],
      ["Drenagem urbana", "NOT_MET"],
    ]);
    expect(p?.breakdown?.[0]?.detail).toContain("3 atestado(s)");
    expect(p?.breakdown?.[1]?.detail).toContain("nenhum atestado");
  });

  /**
   * Parcela que o catálogo não classificou não é "não atende": ninguém
   * conferiu. Virar cruz aqui faria descartar obra que a empresa sabe fazer.
   */
  it("parcela não classificada entra como a conferir, nunca como reprovada", () => {
    const comDuvida = acervo({ unreadable: ["Execução de muro de gabião"] });
    const p = acha(buildPrerequisites(entrada({ archive: comDuvida })), "acervo");
    const duvida = p?.breakdown?.find((b) => b.label === "Execução de muro de gabião");

    expect(duvida?.status).toBe("UNKNOWN");
    expect(p?.breakdown?.some((b) => b.status === "NOT_MET")).toBe(false);
  });

  it("acervo não julgado não inventa desdobramento", () => {
    const p = acha(buildPrerequisites(entrada({ archive: acervo({ determined: false, reasons: ["nenhum acervo cadastrado"] }) })), "acervo");
    expect(p?.breakdown).toBeUndefined();
  });

  it("os demais pré-requisitos seguem sem desdobramento", () => {
    const lista = buildPrerequisites(entrada());
    expect(lista.filter((p) => p.breakdown !== undefined).map((p) => p.id)).toEqual(["acervo"]);
  });
});
