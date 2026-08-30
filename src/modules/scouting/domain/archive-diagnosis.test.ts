import { describe, expect, it } from "vitest";

import type { ArchiveEvidence } from "@/modules/scouting/domain/archive-adherence";
import { diagnoseArchive, diagnoseQueue } from "@/modules/scouting/domain/archive-diagnosis";

const servico = (discipline: string, description: string, parcial: Partial<ArchiveEvidence> = {}): ArchiveEvidence => ({
  serviceId: `${discipline}:${description}`, discipline, description, characteristics: "", quantities: [], ...parcial,
});

const acervo = [
  servico("Obras de arte especiais", "Ponte em concreto armado", { contractValue: 62_000_000 }),
  servico("Túneis", "Túnel em rocha com revestimento"),
  servico("Pavimentação", "Pavimentação asfáltica em CBUQ"),
  // Vocabulário que o catálogo realmente não conhece — conferido à parte.
  servico("Linhas de transmissão", "Linha de transmissão em 138 kV"),
];

describe("diagnóstico do acervo", () => {
  it("conta serviços e quantos têm valor de contrato", () => {
    const d = diagnoseArchive(acervo);
    expect(d.services).toBe(4);
    expect(d.withContractValue).toBe(1);
  });

  /**
   * O acervo invisível: serviço que o catálogo não classifica não sustenta
   * categoria nenhuma, e some da conta sem ninguém perceber.
   */
  it("nomeia as disciplinas que o catálogo não conhece", () => {
    const d = diagnoseArchive(acervo);
    expect(d.orphans).toBe(1);
    expect(d.orphanDisciplines[0]).toEqual({ label: "Linhas de transmissão", count: 1 });
  });

  /**
   * O achado que motivou esta tela: "Túneis" e "Obras de arte especiais" caem
   * na mesma categoria, então um atestado de ponte cobre exigência de túnel.
   */
  it("denuncia categoria que junta disciplinas diferentes", () => {
    const d = diagnoseArchive(acervo);
    const obraDeArte = d.conflations.find((c) => /obra de arte/i.test(c.category));
    expect(obraDeArte?.disciplines).toContain("Túneis");
    expect(obraDeArte?.disciplines).toContain("Obras de arte especiais");
  });

  it("categoria sem nenhum serviço aparece com zero, e não some", () => {
    const d = diagnoseArchive(acervo);
    expect(d.coverage.some((c) => c.count === 0)).toBe(true);
    expect(d.coverage.length).toBeGreaterThan(20);
  });

  it("acervo vazio não quebra o diagnóstico", () => {
    const d = diagnoseArchive([]);
    expect(d.services).toBe(0);
    expect(d.orphans).toBe(0);
    expect(d.conflations).toEqual([]);
  });
});

describe("diagnóstico da fila", () => {
  const fila = [
    { subject: "Construção de ponte em concreto armado sobre o rio Preto" },
    // Vocabulário que o catálogo realmente não conhece — conferido à parte.
    { subject: "Barragem de terra compactada com núcleo argiloso" },
    { subject: "Pavimentação asfáltica de vias urbanas", estimatedValue: 20_000_000 },
  ];

  it("separa julgadas de não julgadas, com o motivo", () => {
    const d = diagnoseQueue(fila, acervo);
    expect(d.total).toBe(3);
    expect(d.judged).toBe(2);
    expect(d.unjudged[0]?.label).toContain("não descreve serviços reconhecíveis");
  });

  it("distribui as notas em faixas que somam as julgadas", () => {
    const d = diagnoseQueue(fila, acervo);
    expect(d.bands.reduce((soma, f) => soma + f.count, 0)).toBe(d.judged);
  });

  it("fila vazia devolve zeros, sem dividir por zero", () => {
    const d = diagnoseQueue([], acervo);
    expect(d.total).toBe(0);
    expect(d.judged).toBe(0);
    expect(d.bands.every((f) => f.count === 0)).toBe(true);
  });
});
