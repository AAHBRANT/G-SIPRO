import { describe, expect, it } from "vitest";

import { parcelasEmListaCorrida } from "@/modules/scouting/domain/parcelas-em-lista";

/**
 * Trecho REAL do edital de São Joaquim de Bicas/MG (esgotamento sanitário,
 * 01612516000150-1-000304/2026), como o extrator de PDF o devolve: sem quebra
 * de linha, com espaços múltiplos no meio dos nomes e o código da tabela de
 * referência colado na descrição.
 */
const EDITAL_REAL =
  'demonstrando que o mesmo executou diretamente obra de característica/grau de complexidade similar ' +
  'ou superior ao objeto desta licitação, necessariamente abrangendo: PREFEITURA MUNICIPAL DE SÃO ' +
  'JOAQUIM DE BICAS  ESTADO DE MINAS GERAIS - CNPJ: 01.612.516/0001-50  Fone: (031) 3534-9000  12  ' +
  'EXECUÇÃO DE PAVIMENTO COM APLICAÇÃO DE CONCRETO ASFÁLTICO, CAMADA DE ROLAMENTO - EXCLUSIVE CARGA ' +
  'E TRANSPORTE. AF_10/2025;  ESCORAMENTO   DE   VALA,   TIPO   CONTÍNUO   COM   PERFIL   METÁLICO   ' +
  '"U",   COM PROFUNDIDADE DE 3,0 A 4,5 M, LARGURA MENOR QUE 1,5 M. AF_01/2026;  ' +
  '_____________________________  E.3 Para atendimento à QUALIFICAÇÃO TÉCNICO-OPERACIONAL, ' +
  'apresentar para cada parcela de serviço(s) relevante(s), certidões ou atestado(s), que comprove(m) ' +
  'que o licitante tenha executado para órgão ou entidade da administração pública direta ou indireta, ' +
  'federal, estadual, municipal ou do Distrito Federal, ou ainda, para empresas privadas, o(s) ' +
  'seguinte(s) serviço(s) e quantidade(es):  EXECUÇÃO DE PAVIMENTO COM APLICAÇÃO DE CONCRETO ' +
  'ASFÁLTICO, CAMADA DE ROLAMENTO - EXCLUSIVE CARGA E TRANSPORTE. AF_10/2025 – 1.684,565 M3  ' +
  'ESCORAMENTO   DE   VALA,   TIPO   CONTÍNUO   COM   PERFIL   METÁLICO   "U",   COM PROFUNDIDADE ' +
  'DE 3,0 A 4,5 M, LARGURA MENOR QUE 1,5 M. AF_01/2026 - 7.759,63 M2  ______________  E.4 ' +
  'Considerando que foi utilizada a Curva ABC do orçamento';

describe("parcelas escritas em lista corrida", () => {
  const parcelas = parcelasEmListaCorrida(EDITAL_REAL);

  it("acha as duas parcelas do edital real", () => {
    expect(parcelas).toHaveLength(2);
  });

  /** O quantitativo em formato brasileiro não pode virar erro de mil vezes. */
  it("lê os quantitativos com a unidade certa", () => {
    expect(parcelas[0]?.quantity).toBe(1684.565);
    expect(parcelas[0]?.unit).toBe("m³");
    expect(parcelas[1]?.quantity).toBe(7759.63);
    expect(parcelas[1]?.unit).toBe("m²");
  });

  /**
   * As duas primeiras tentativas erraram aqui: uma trouxe "Distrito Federal,
   * ou ainda, para empresas privadas" como nome de serviço, a outra um
   * fragmento truncado do fim da frase.
   */
  it("a descrição é o nome do serviço, não o fim da frase anterior", () => {
    expect(parcelas[0]?.description).toMatch(/^EXECUÇÃO DE PAVIMENTO/);
    expect(parcelas[1]?.description).toMatch(/^ESCORAMENTO DE VALA/);
    expect(parcelas[0]?.description).not.toMatch(/Distrito Federal/);
  });

  it("tira o código da tabela de referência do nome do serviço", () => {
    expect(parcelas[0]?.description).not.toMatch(/AF_10/);
    expect(parcelas[1]?.description).not.toMatch(/AF_01/);
  });

  it("junta os espaços múltiplos que o PDF deixa no meio do nome", () => {
    expect(parcelas[1]?.description).not.toMatch(/ {2}/);
  });
});

describe("o que não pode virar parcela", () => {
  /** Sem a seção de qualificação, não há lista para ler. */
  it("texto sem a âncora devolve vazio", () => {
    const semAncora = "O prazo de garantia será de 5 anos – 60 M de extensão da via.";
    expect(parcelasEmListaCorrida(semAncora)).toEqual([]);
  });

  /**
   * O edital é cheio de número seguido de letra fora da seção. A janela curta
   * depois da âncora é o que impede o acervo de encher de lixo.
   */
  it("não pega número que está longe da âncora", () => {
    const longe = "QUALIFICAÇÃO TÉCNICO-OPERACIONAL: conforme a lei." + " texto de enchimento.".repeat(300)
      + " MANUTENÇÃO DE VIAS URBANAS - 500 M2";
    expect(parcelasEmListaCorrida(longe)).toEqual([]);
  });

  it("recusa unidade que não é de obra", () => {
    const naoUnidade = "QUALIFICAÇÃO TÉCNICO-OPERACIONAL: apresentar: EXECUÇÃO DE OBRA CIVIL COMPLETA – 30 dd";
    expect(parcelasEmListaCorrida(naoUnidade)).toEqual([]);
  });

  it("não repete a mesma parcela", () => {
    const repetida = "QUALIFICAÇÃO TÉCNICO-OPERACIONAL: apresentar: "
      + "EXECUÇÃO DE REDE COLETORA DE ESGOTO – 1.000 M  EXECUÇÃO DE REDE COLETORA DE ESGOTO – 1.000 M";
    expect(parcelasEmListaCorrida(repetida)).toHaveLength(1);
  });

  it("aceita a grafia 'capacidade técnico-operacional'", () => {
    const outra = "b) atestado de capacidade técnico-operacional comprovando: "
      + "IMPLANTAÇÃO DE ESTAÇÃO ELEVATÓRIA DE ESGOTO – 4 UN";
    expect(parcelasEmListaCorrida(outra)).toHaveLength(1);
  });
});
