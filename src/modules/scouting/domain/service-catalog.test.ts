import { describe, expect, it } from "vitest";

import { categoriesIn, serviceCatalog } from "@/modules/scouting/domain/service-catalog";

const ids = (texto: string) => categoriesIn(texto).map((c) => c.id).sort();

/**
 * Estes casos são medidos, não imaginados: saíram de uma auditoria do catálogo
 * contra ele mesmo, em 29/08/2026. O casamento era por substring pura, e cada
 * linha abaixo creditava uma categoria que a empresa não tinha — sempre para
 * MAIS cobertura, que é a direção que faz montar proposta e ser inabilitado.
 */
describe("fronteira de palavra: os falsos casamentos que já aconteceram", () => {
  it.each([
    ["Execução de concretagem de laje em concreto armado", "tratamento", "eta dentro de concretagem"],
    ["Assentamento de sarjeta e meio-fio", "tratamento", "eta dentro de sarjeta"],
    ["Construção de canaleta de drenagem", "tratamento", "eta dentro de canaleta"],
    ["Etapa 3 da obra: acabamento", "tratamento", "eta dentro de etapa"],
    ["Fornecimento de defensa metálica", "tratamento", "eta dentro de metalica"],
    ["Implantação de subestação abrigada de 138 kV", "fundacao", "estaca dentro de subestacao"],
    ["Os serviços serão medidos posteriormente", "iluminacao", "poste dentro de posteriormente"],
    ["Construção de canaleta de drenagem", "canalizacao", "canal dentro de canaleta"],
    ["Assentamento de bloquete sextavado", "tratamento", "ete dentro de bloquete"],
  ])("%s não credita %s (%s)", (texto, categoriaProibida) => {
    expect(ids(texto)).not.toContain(categoriaProibida);
  });

  /** E o que ele deveria reconhecer continua reconhecido. */
  it.each([
    ["Execução de concretagem de laje", "estrutura-concreto"],
    ["Assentamento de sarjeta e meio-fio", "drenagem"],
    ["Implantação de subestação abrigada", "instalacoes-eletricas"],
    ["Instalação de poste de iluminação pública", "iluminacao"],
    ["Fornecimento de defensa metálica", "sinalizacao"],
    ["Assentamento de bloquete sextavado", "pavimento-rigido"],
    ["Estação de tratamento de esgoto", "tratamento"],
  ])("%s continua creditando %s", (texto, esperada) => {
    expect(ids(texto)).toContain(esperada);
  });
});

describe("radical e palavra inteira", () => {
  /** O radical existe para pegar a flexão: fundação, fundações, fundacoes. */
  it.each(["fundação", "fundações", "obras de fundação profunda"])("radical pega %s", (texto) => {
    expect(ids(texto)).toContain("fundacao");
  });

  /** Palavra inteira aceita plural comum e o plural de -ão. */
  it.each([
    ["estaca hélice contínua", "fundacao"],
    ["estacas metálicas cravadas", "fundacao"],
    ["microestaca injetada", "fundacao"],
    ["escavação em rocha", "terraplenagem"],
    ["escavações em rocha", "terraplenagem"],
    ["poço tubular profundo", "poco"],
    ["poços tubulares", "poco"],
  ])("%s casa %s", (texto, esperada) => {
    expect(ids(texto)).toContain(esperada);
  });

  it("palavra que apenas contém o termo não casa", () => {
    expect(ids("descrição do subestaqueamento")).not.toContain("fundacao");
  });
});

describe("integridade do catálogo", () => {
  it("todo termo tem um padrão compilado", () => {
    for (const categoria of serviceCatalog) {
      expect(categoria.patterns.length).toBe(categoria.terms.length);
    }
  });

  it("nenhum termo guarda o marcador de radical", () => {
    for (const categoria of serviceCatalog) {
      for (const termo of categoria.terms) expect(termo).not.toContain("*");
    }
  });

  it("os identificadores não se repetem", () => {
    const vistos = serviceCatalog.map((c) => c.id);
    expect(new Set(vistos).size).toBe(vistos.length);
  });

  /** Texto vazio ou genérico não pode creditar nada. */
  it.each(["", "   ", "objeto conforme edital", "contratação de empresa especializada"])(
    "%s não credita categoria nenhuma", (texto) => {
      expect(categoriesIn(texto)).toHaveLength(0);
    });
});
