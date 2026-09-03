import { describe, expect, it } from "vitest";

import { editalRelevance, isEdital, PESO_EDITAL } from "@/modules/scouting/domain/edital-relevance";

/** Ordena como o serviço ordena, para conferir a fila e não o número. */
const fila = (nomes: readonly string[]): string[] =>
  [...nomes].sort((a, b) => editalRelevance(a) - editalRelevance(b));

describe("qual documento traz a exigência", () => {
  /**
   * O pacote real da Concorrência 17/2026 de Pedra Preta/MT, com os 18
   * arquivos que estavam dentro do .rar. A justificativa de qualificação
   * técnica é a primeira porque é a única que traz as seis parcelas com
   * quantitativo; o edital vem logo atrás porque fecha consórcio, CAT e visita.
   */
  it("põe a justificativa de qualificação técnica na frente do edital", () => {
    const pacote = [
      "PROJETOS.pdf",
      "RELATÓRIO FOTOGRÁFICO.pdf",
      "EDITAL.pdf",
      "Justificativa de Qualificação Técnica (2).pdf",
      "MEMORIAL DESCRITIVO.pdf",
      "ORÇAMENTOS.pdf",
    ];

    expect(fila(pacote).slice(0, 3)).toEqual([
      "Justificativa de Qualificação Técnica (2).pdf",
      "EDITAL.pdf",
      "MEMORIAL DESCRITIVO.pdf",
    ]);
  });

  it("deixa prancha, foto e planilha por último", () => {
    for (const inutil of ["PROJETOS.pdf", "RELATÓRIO FOTOGRÁFICO.pdf", "Cronograma fisico-financeiro.xlsx", "Curva ABC de servicos.xlsx"]) {
      expect(editalRelevance(inutil)).toBeGreaterThan(PESO_EDITAL);
    }
  });

  it("reconhece o termo de referência antes do projeto básico e do edital", () => {
    expect(fila(["Edital 17-2026.pdf", "Projeto Básico.pdf", "Termo de Referência.pdf"])).toEqual([
      "Termo de Referência.pdf",
      "Projeto Básico.pdf",
      "Edital 17-2026.pdf",
    ]);
  });

  /**
   * "ANEXO I — Termo de Referência" é termo de referência, não anexo genérico.
   * Valer o primeiro padrão que casasse daria o peso do anexo e enterraria o
   * documento no fim da fila.
   */
  it("vale o melhor padrão que casou, não o primeiro", () => {
    expect(editalRelevance("ANEXO I - Termo de Referência.pdf"))
      .toBe(editalRelevance("Termo de Referência.pdf"));
  });

  it("junta os textos que descrevem o mesmo arquivo", () => {
    // O PNCP declara o tipo numa coluna e o título noutra; sozinho, nenhum diz.
    expect(editalRelevance("Anexo", "Justificativa de qualificação técnica"))
      .toBeLessThan(editalRelevance("Anexo", "Documento"));
  });

  it("dá peso neutro a nome que não diz nada", () => {
    const neutro = editalRelevance("199051_editais_1787665929.zip");
    expect(neutro).toBeGreaterThan(PESO_EDITAL);
    expect(neutro).toBeLessThan(editalRelevance("PROJETOS.pdf"));
  });
});

/**
 * Grafia de arquivo publicado por prefeitura.
 *
 * Os três casos abaixo derrubavam a régua do jeito mais silencioso possível: o
 * documento certo continuava na fila, só que atrás do errado.
 */
describe("o nome como a prefeitura escreve", () => {
  /** `\s+` no padrão não casa `_` nem `-`, e é assim que o arquivo vem. */
  it("aceita sublinhado e hífen no lugar do espaço", () => {
    const comEspaco = editalRelevance("Justificativa de Qualificação Técnica.pdf");

    expect(editalRelevance("JUSTIFICATIVA_DE_QUALIFICACAO_TECNICA.pdf")).toBe(comEspaco);
    expect(editalRelevance("Justificativa-de-Qualificacao-Tecnica.pdf")).toBe(comEspaco);
    expect(editalRelevance("PARCELAS_DE_MAIOR_RELEVANCIA.pdf")).toBe(comEspaco);
  });

  /**
   * `PROJETO_BASICO.pdf` casava só o padrão de lixo (`projetos`) e caía para 90
   * — atrás até de um nome ilegível, e empatado com as 17 MB de pranchas.
   */
  it("não confunde projeto básico com a pasta de pranchas", () => {
    const basico = editalRelevance("Projeto Básico.pdf");

    expect(editalRelevance("PROJETO_BASICO.pdf")).toBe(basico);
    expect(editalRelevance("PROJETO-BASICO.pdf")).toBe(basico);
    expect(basico).toBeLessThan(editalRelevance("PROJETOS.pdf"));
  });

  /**
   * O `\b` do JavaScript é ASCII: em "TRÁFEGO" o acento conta como fronteira de
   * palavra, então `\bTR\b` casava "TRÁ" e dava peso de termo de referência a
   * uma contagem de tráfego — que passava na frente do edital.
   */
  it("não lê 'TR' dentro de palavra acentuada", () => {
    for (const nome of ["ANEXO XII - CONTAGEM DE TRÁFEGO.pdf", "TRÊS LAGOAS.pdf", "TRÂNSITO.pdf"]) {
      expect(editalRelevance(nome)).toBeGreaterThan(editalRelevance("Termo de Referência.pdf"));
    }
    expect(editalRelevance("ANEXO XII - CONTAGEM DE TRÁFEGO.pdf"))
      .toBeGreaterThan(editalRelevance("EDITAL.pdf"));
  });
});

/**
 * O serviço precisa perguntar "este documento é o edital?", e não "o peso dele
 * é 30?". Peso é o MÍNIMO entre os padrões que casaram, então um edital cujo
 * nome traga qualquer token de faixa menor sai com outro número — e a
 * comparação por igualdade deixava a segunda leitura sem acontecer, calada.
 */
describe("reconhecer o edital", () => {
  it("reconhece o edital mesmo quando o peso dele não é o do edital", () => {
    const nome = "EDITAL PREGAO 17-2026 TR.pdf";

    expect(editalRelevance(nome)).toBeLessThan(PESO_EDITAL);
    expect(isEdital(nome)).toBe(true);
  });

  it("reconhece com acento, caixa e separador variados", () => {
    expect(isEdital("EDITAL.pdf")).toBe(true);
    expect(isEdital("Edital_17-2026.PDF")).toBe(true);
    expect(isEdital("Anexo", "edital de concorrência")).toBe(true);
  });

  it("não confunde outro documento com o edital", () => {
    expect(isEdital("Justificativa de Qualificação Técnica.pdf")).toBe(false);
    expect(isEdital("MEMORIAL DESCRITIVO.pdf")).toBe(false);
    expect(isEdital("PROJETOS.pdf")).toBe(false);
  });
});
