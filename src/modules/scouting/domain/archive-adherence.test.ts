import { describe, expect, it } from "vitest";

import {
  certaintyFor,
  computeArchiveAdherence,
  type ArchiveEvidence,
  type ArchiveRequirement,
} from "@/modules/scouting/domain/archive-adherence";

const servico = (parcial: Partial<ArchiveEvidence> = {}): ArchiveEvidence => ({
  serviceId: "s1",
  discipline: "Pavimentação asfáltica",
  description: "Execução de revestimento em CBUQ",
  characteristics: "espessura 5 cm",
  contractValue: 40_000_000,
  contractSubject: "Duplicação da rodovia estadual",
  ...parcial,
});

const exigencia = (parcial: Partial<ArchiveRequirement> = {}): ArchiveRequirement => ({
  workTypes: ["PAVING"],
  estimatedValue: 30_000_000,
  inferred: true,
  ...parcial,
});

describe("certaintyFor", () => {
  it("dá certeza máxima quando o tipo aparece na DISCIPLINA", () => {
    expect(certaintyFor(servico({ discipline: "Pavimentação e drenagem" }), "PAVING")).toBe("IDENTICAL");
  });

  it("dá certeza menor quando o tipo só aparece na descrição", () => {
    // Disciplina é declaração; menção solta no meio de um texto é indício.
    const evidencia = servico({ discipline: "Drenagem urbana", description: "inclui trecho de pavimentação" });
    expect(certaintyFor(evidencia, "PAVING")).toBe("LIKELY");
  });

  /**
   * O objeto do contrato NÃO entra na comparação. Um serviço de drenagem
   * executado dentro de um contrato de ponte não é acervo de obra de arte
   * especial — parcela de maior relevância se prova pelo serviço.
   */
  it("não empresta o objeto do contrato ao serviço", () => {
    const evidencia = servico({ discipline: "Drenagem", description: "bueiros", characteristics: "", contractSubject: "Construção de ponte sobre o rio" });
    expect(certaintyFor(evidencia, "SPECIAL_STRUCTURE")).toBe("NONE");
  });

  it("não inventa correspondência quando não há nenhuma", () => {
    expect(certaintyFor(servico(), "SANITATION")).toBe("NONE");
  });

  it("ignora acentuação e caixa", () => {
    expect(certaintyFor(servico({ discipline: "PAVIMENTAÇÃO" }), "PAVING")).toBe("IDENTICAL");
  });
});

describe("computeArchiveAdherence", () => {
  it("dá nota cheia quando o acervo comprova o tipo e cobre o porte", () => {
    const a = computeArchiveAdherence(exigencia(), [servico()]);
    expect(a.determined).toBe(true);
    expect(a.score).toBe(100);
    expect(a.scale).toBe("COVERED");
  });

  it("desconta quando o maior contrato executado é menor que a obra a disputar", () => {
    const a = computeArchiveAdherence(exigencia({ estimatedValue: 120_000_000 }), [servico({ contractValue: 40_000_000 })]);
    expect(a.scale).toBe("BELOW");
    expect(a.score).toBeLessThan(100);
    expect(a.score).toBeGreaterThan(60); // o tipo continua comprovado
    expect(a.reasons.join(" ")).toContain("maior obra executada");
  });

  it("desconta a correspondência apenas provável", () => {
    const provavel = servico({ discipline: "Drenagem urbana", description: "inclui pavimentação do acesso" });
    const a = computeArchiveAdherence(exigencia(), [provavel]);
    const certa = computeArchiveAdherence(exigencia(), [servico()]);
    expect(a.score).toBeLessThan(certa.score);
    expect(a.matches[0]?.certainty).toBe("LIKELY");
  });

  /**
   * A distinção que evita o pior erro desta tela: acervo vazio não é acervo
   * insuficiente. Dizer 0% com o cadastro vazio faria a equipe descartar obra
   * que ela sabe fazer, só porque ninguém lançou a CAT no sistema.
   */
  it("não julga quando não há acervo cadastrado", () => {
    const a = computeArchiveAdherence(exigencia(), []);
    expect(a.determined).toBe(false);
    expect(a.reasons).toContain("nenhum acervo cadastrado para confrontar");
  });

  it("não julga quando o objeto não revela o tipo de obra", () => {
    const a = computeArchiveAdherence(exigencia({ workTypes: [] }), [servico()]);
    expect(a.determined).toBe(false);
  });

  it("marca a nota como estimada enquanto o requisito não vier do edital", () => {
    expect(computeArchiveAdherence(exigencia(), [servico()]).requirementInferred).toBe(true);
    expect(computeArchiveAdherence(exigencia({ inferred: false }), [servico()]).requirementInferred).toBe(false);
  });

  /**
   * Sem comparação de porte a nota para nos 70 pontos do tipo.
   *
   * Não é castigo, é limite do que se mediu — e a primeira versão errava nos
   * dois sentidos. Zerar puniria a obra grande, que é onde o sigilo é comum.
   * Dar 100 foi pior: no diagnóstico contra dados reais, 57 de 61 licitações
   * saíram entre 90 e 100% porque um único serviço do ramo bastava.
   */
  it("limita a nota a 70 quando o orçamento é sigiloso: nem zero, nem cheia", () => {
    const semValor = computeArchiveAdherence(exigencia({ estimatedValue: undefined }), [servico()]);
    expect(semValor.scale).toBe("UNKNOWN");
    expect(semValor.score).toBe(70);
    expect(semValor.reasons.join(" ")).toContain("orçamento sigiloso");
  });

  it("limita igual quando o acervo não registra valor, e diz que é do cadastro", () => {
    const a = computeArchiveAdherence(exigencia(), [servico({ contractValue: undefined })]);
    expect(a.scale).toBe("UNKNOWN");
    expect(a.score).toBe(70);
    expect(a.largestExecuted).toBeUndefined();
    // O motivo distingue o que é da licitação do que é cadastro faltando.
    expect(a.reasons.join(" ")).toContain("acervo sem valor de contrato");
  });

  it("cem por cento só sai com ramo comprovado E porte coberto", () => {
    const cheia = computeArchiveAdherence(exigencia(), [servico()]);
    expect(cheia.score).toBe(100);
    expect(cheia.scale).toBe("COVERED");
  });

  it("exige os dois tipos quando a obra é mista", () => {
    const soPavimento = computeArchiveAdherence(
      exigencia({ workTypes: ["PAVING", "SPECIAL_STRUCTURE"] }),
      [servico()],
    );
    const ambos = computeArchiveAdherence(
      exigencia({ workTypes: ["PAVING", "SPECIAL_STRUCTURE"] }),
      [servico(), servico({ serviceId: "s2", discipline: "Obra de arte especial — ponte" })],
    );
    expect(soPavimento.score).toBeLessThan(ambos.score);
    expect(soPavimento.reasons.join(" ")).toContain("sem acervo de");
  });

  it("guarda as evidências que sustentam cada correspondência", () => {
    const foraDoTipo = servico({ serviceId: "s3", discipline: "Saneamento", description: "adutora", characteristics: "" });
    const a = computeArchiveAdherence(exigencia(), [servico(), servico({ serviceId: "s2" }), foraDoTipo]);
    expect(a.matches[0]?.evidence.map((e) => e.serviceId)).toEqual(["s1", "s2"]);
  });

  it("usa o MAIOR contrato entre as evidências para comparar porte", () => {
    const a = computeArchiveAdherence(exigencia({ estimatedValue: 50_000_000 }), [
      servico({ serviceId: "s1", contractValue: 20_000_000 }),
      servico({ serviceId: "s2", contractValue: 62_000_000 }),
    ]);
    expect(a.largestExecuted).toBe(62_000_000);
    expect(a.scale).toBe("COVERED");
  });

  it("a nota nunca sai da faixa de 0 a 100", () => {
    const casos = [
      computeArchiveAdherence(exigencia({ estimatedValue: 1 }), [servico({ contractValue: 900_000_000 })]),
      computeArchiveAdherence(exigencia({ estimatedValue: 900_000_000 }), [servico({ contractValue: 1 })]),
    ];
    for (const a of casos) {
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("as razões vão para a tela, não para o log", () => {
  it("nomeia o ramo em português, não com o código interno", () => {
    const a = computeArchiveAdherence(exigencia(), [servico()]);
    const texto = a.reasons.join(" ");
    expect(texto).toContain("pavimentação");
    expect(texto).not.toContain("PAVING");
    expect(texto).not.toContain("paving");
  });

  it("nomeia também o ramo que faltou", () => {
    const a = computeArchiveAdherence(exigencia({ workTypes: ["SANITATION"] }), [servico()]);
    expect(a.reasons.join(" ")).toContain("sem acervo de saneamento");
  });
});
