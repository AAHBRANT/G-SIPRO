import { describe, expect, it } from "vitest";

import { computeArchiveAdherence, type ArchiveEvidence } from "@/modules/scouting/domain/archive-adherence";

/**
 * Guarda de custo, não de microssegundo.
 *
 * A fila de triagem carrega até 900 licitações e confronta cada uma contra o
 * acervo inteiro. Com o acervo real da casa — milhares de serviços — isso
 * derrubou a tela: o clique no card não abria nada, porque a página levava
 * dezenas de segundos para montar.
 *
 * O limite é folgado de propósito (a máquina da CI é mais lenta). O que ele
 * tranca é a ORDEM DE GRANDEZA: sem reaproveitar o índice do acervo, este
 * teste leva ~30 s e falha; com ele, fica abaixo de um segundo.
 */
const acervo = (n: number): ArchiveEvidence[] =>
  Array.from({ length: n }, (_, i) => ({
    serviceId: `s${i}`,
    discipline: ["Obras de arte especiais", "Pavimentação", "Drenagem", "Terraplenagem"][i % 4]!,
    description: `Serviço ${i} em concreto armado`,
    characteristics: `${1000 + i} m`,
    quantities: [`${1000 + i} m`],
    contractValue: 10_000_000 + i,
  }));

describe("custo de montar a fila", () => {
  it("900 licitações contra acervo de 2000 serviços em menos de 3 s", () => {
    const arquivo = acervo(2_000);
    const objetos = Array.from({ length: 900 }, (_, i) => `Ponte em concreto armado no município ${i}`);

    const inicio = performance.now();
    for (const objeto of objetos) {
      computeArchiveAdherence({ sources: [{ text: objeto }], inferred: true }, arquivo);
    }
    const decorrido = performance.now() - inicio;

    expect(decorrido).toBeLessThan(3_000);
  });
});
