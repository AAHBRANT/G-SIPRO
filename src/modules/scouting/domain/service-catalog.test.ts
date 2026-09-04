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
    ["Fornecimento e aplicação de manta asfáltica na laje de cobertura", "pavimento-asfaltico", "asfalt* dentro de manta asfaltica"],
    ["Impermeabilização de banheiro com manta asfáltica", "pavimento-asfaltico", "asfalt* dentro de manta asfaltica"],
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
    ["Fornecimento e aplicação de manta asfáltica na laje de cobertura", "impermeabilizacao"],
  ])("%s continua creditando %s", (texto, esperada) => {
    expect(ids(texto)).toContain(esperada);
  });
});

/**
 * Achado no diagnóstico do catálogo em produção (03/09/2026): "manta
 * asfáltica" — impermeabilização de laje — sujava "Pavimento asfáltico" com
 * banheiro e cobertura, porque "asfalt*" era radical solto.
 *
 * O conserto NÃO é trocar o radical por uma lista de frases: a primeira
 * tentativa fez isso e quebrou "Pavimentação asfáltica" (que É pavimento),
 * porque nenhuma frase da lista previa essa flexão específica. O radical
 * continua largo — "asfalt*" pega qualquer "asfalt-" — só que com uma exceção
 * pontual: não conta quando a palavra logo antes é "manta".
 */
describe("pavimento asfáltico não confunde com manta asfáltica", () => {
  it.each([
    "Execução de pavimento asfáltico em CBUQ",
    "Aplicação de emulsão asfáltica RR-2C, com capa selante",
    "Fornecimento e aplicação de asfalto em vias urbanas",
    "Recapeamento asfáltico da rodovia",
    "Execução de camada asfáltica de rolamento",
    "Concreto Asfáltico Usinado a Quente (CAUQ)",
    // Flexão que a primeira tentativa (lista de frases) deixou de fora.
    "Pavimentação asfáltica em vias urbanas",
    "Fornecimento de mistura asfáltica usinada a quente",
    "Reforço do pavimento com camada asfáltica adicional",
  ])("continua reconhecendo: %s", (texto) => {
    expect(ids(texto)).toContain("pavimento-asfaltico");
  });

  it.each([
    "Fornecimento e aplicação de manta asfáltica",
    "Impermeabilização com manta asfáltica em laje de cobertura",
    "Manta asfáltica para reservatório",
  ])("nunca credita pavimento por causa de manta: %s", (texto) => {
    expect(ids(texto)).not.toContain("pavimento-asfaltico");
  });

  // A exceção olha só a palavra IMEDIATAMENTE anterior ao "asfalt" — "manta"
  // em outra parte da frase, longe do "asfalt", não pode bloquear o resto.
  it("'manta' longe do 'asfalt' não bloqueia o resto da frase", () => {
    expect(ids("Fornecimento de manta geotêxtil e pavimentação asfáltica")).toContain("pavimento-asfaltico");
  });
});

/**
 * Termos acrescentados a partir do diagnóstico do catálogo em produção
 * (03/09/2026): disciplinas reais do acervo — 2.209 serviços — que nenhuma
 * categoria reconhecia. Cada caso usa o texto como o atestado realmente
 * escreve, não uma paráfrase.
 */
describe("disciplinas achadas no diagnóstico de 03/09/2026", () => {
  it.each([
    // A própria palavra que dá nome à categoria não estava na lista — o achado
    // que sozinho explicava a maior fatia dos 946 não reconhecidos.
    ["CASA 01 - AV. LUIS GUSHIKEN, 68 / ACABAMENTO", "acabamento"],
    ["Acabamento", "acabamento"],
  ])("%s casa %s", (texto, esperada) => {
    expect(ids(texto)).toContain(esperada);
  });

  // "Elétrica" e "Hidráulica" sozinhas, sem a palavra "instalação" na frente —
  // é assim que o atestado rotula, não como o catálogo original esperava.
  it.each([
    ["Elétrica", "instalacoes-eletricas"],
    ["CASA 02 - AV. LUIS GUSHIKEN, 75 / ELÉTRICA", "instalacoes-eletricas"],
    ["Hidráulica", "instalacoes-hidraulicas"],
    ["CASA 03 - ESTRADA DO CIPÓ / HIDRÁULICA", "instalacoes-hidraulicas"],
  ])("%s casa %s", (texto, esperada) => {
    expect(ids(texto)).toContain(esperada);
  });

  /**
   * "Hidrossanitário" (uma palavra) e "hidro-sanitário" (com hífen) são a
   * MESMA coisa escrita de duas formas correntes em orçamento de obra. O
   * hífen não é removido por `normalizeText`, então precisava de termo à
   * parte — sem ele "INSTALAÇÕES HIDRO-SANITÁRIAS" ficava de fora mesmo com o
   * radical "hidrossanitar*" já no catálogo.
   */
  it("reconhece hidro-sanitário com hífen, não só hidrossanitário grudado", () => {
    expect(ids("INSTALAÇÕES HIDRO-SANITÁRIAS")).toContain("instalacoes-hidraulicas");
    expect(ids("Instalação hidro sanitária completa")).toContain("instalacoes-hidraulicas");
  });

  it.each([
    ["Poços de Visita – Ø 2,40 m", "drenagem"],
    ["Muros e cortinas de flexão", "contencao"],
    // "Barragem de Enrocamento" é a técnica de pedra lançada, a mesma
    // família do gabião já catalogado — só que sem a tela metálica.
    ["Barragem de Enrocamento com Vertedouro - Enrocamento de Pedra", "contencao"],
    ["Urbanismo", "urbanizacao"],
    ["Rebaixamento do Lençol Freático", "fundacao"],
    ["Retaludamento", "terraplenagem"],
    // "Movimento de Terra" (sem -ção) é palavra diferente de "movimentação de
    // terra" (com -ção), já catalogada — nenhuma das duas pluraliza na outra.
    ["Movimento de Terra — Maciços Compactados", "terraplenagem"],
    ["6 CALÇADA/CICLOFAIXA", "pavimento-rigido"],
    ["PASSEIO", "pavimento-rigido"],
  ])("%s casa %s", (texto, esperada) => {
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

  it("nenhum termo guarda o marcador de exceção", () => {
    for (const categoria of serviceCatalog) {
      for (const termo of categoria.terms) expect(termo).not.toContain("!");
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
