import { describe, expect, it } from "vitest";

import {
  editalRequirementFromText,
  extractInstitutionalRequirement,
  extractRelevantServicesSection,
} from "@/modules/scouting/domain/edital-text-requirement";

/**
 * Trechos verdadeiros, encurtados — não o edital de 213 KB inteiro, mas o
 * texto real da Concorrência 17/2026 de Pedra Preta/MT, a licitação que
 * motivou este módulo. Cortar para caber no teste não reescreve uma vírgula:
 * é o texto como o pdfjs-dist devolveu.
 */
const TRECHO_CONSORCIO = `2.3. Empresas reunidas sob a forma de consórcio ou quaisquer outras
modalidades de associação; 2.3.1. Justificativa da vedação de empresa em
consórcio. Conforme Acordão do Tribunal de Contas da União 2831/2012, onde
atribui à Administração a prerrogativa de admitir a participação de
consórcios, desde que faça justificativa.`;

const TRECHO_CAT = `9.7.2. Comprovação de aptidão para desempenho de atividade pertinente e
compatível em características com o objeto da licitação. 9.7.3. Certidão(ões)
de Acervo Técnico – CAT, emitida(s) pelo CREA ou CAU. 9.7.4. Apresentação de
Pessoal Técnico.`;

const TRECHO_VISITA = `27.1. Para mais informações referente a visita técnica entre em contato
através do telefone (66) 3486-4400. 27.2. O Licitante poderá declinar do
direito de realizar a vistoria técnica.`;

const TRECHO_JUSTIFICATIVA = `d) Qualificação Técnico - Operacional - Art. 67, inciso II e §§ 1º e 2º da
Lei nº 14.133/2021: Atestado em nome da empresa licitante que comprove
execução de serviços com características semelhantes ou superiores, com
exigência mínima, devidamente registrados nos conselhos profissionais
competentes. ITENS DESCRIÇÃO DOS SERVIÇOS QUANTIDADE ORÇADA PERCENTUAL
ORÇADO QUANTIDADE TÉCNICO PROFISSIONAL IGUAL OU SUPERIOR PERCENTUAL
REQUERIDO PARA TÉCNICO PROFISSIONAL 1 EXECUÇÃO DE PASSEIO (CALÇADA) OU PISO
DE CONCRETO COM CONCRETO MOLDADO IN LOCO, USINADO C20, ACABAMENTO
CONVENCIONAL, NÃO ARMADO. (OU SEMELHANTE) 295,83 M³ 100% 118,33 M³ 4 0% 2
TUBO DE CONCRETO PARA REDES COLETORAS DE ÁGUAS PLUVIAIS, JUNTA RÍGIDA,
INSTALADO EM LOCAL COM BAIXO NÍVEL DE INTERFERÊNCIAS - FORNECIMENTO E
ASSENTAMENTO. (OU SEMELHANTE) 1.125,96 M 100% 450,38 M 4 0% JUSTIFICATIVA:
A exigência de atestado técnico-operacional com quantitativo mínimo
encontra respaldo expresso no art. 67 da Lei 14.133/2021.`;

/** A MESMA frase de título aparece de passagem, explicando outra seção —
 *  não pode ser confundida com o título de verdade. */
const TRECHO_MENCAO_DE_PASSAGEM = `a demonstração da capacidade técnica do profissional, e não da empresa (o
que seria tratado na qualificação técnico-operacional). c) Apresentação de
Pessoal Técnico – Art. 67, III da Lei 14.133/2021.`;

/**
 * Trechos verdadeiros do edital 011/26 (Concorrência) de Santa Cruz do Sul/RS
 * — segundo município testado, com estrutura de documento bem diferente da
 * de Pedra Preta. Mesma regra: cortar não reescreve o que fica.
 */
const TRECHO_SANTACRUZ_LISTA_PARCELAS = `e.2) Os atestados ou certidões solicitados deverão comprovar a execução
de serviços de características semelhantes e de complexidade tecnológica
equivalente ou superior as parcelas de maior relevância técnica ou valor
significativo, que são:
•   Execução de Pavimentação com Bloco Intertravado de no mínimo 656,95m²;
•   Execução de Sub-Base para Pavimentação de no mínimo 135,33 m³;
•   Execução de Microdrenagem de no mínimo 103 m.
e.3) Será admitida, para fins de comprovação de quantitativo mínimo, a
apresentação e o somatório de diferentes atestados executados de forma
concomitante.`;

/**
 * A vedação de consórcio não repete o verbo perto do item — vem uma vez no
 * cabeçalho ("Não poderão disputar esta licitação"), e "consórcio" só
 * reaparece bem mais adiante como mais uma linha de uma lista numerada
 * (aqui, itens 3.8.2 a 3.8.4 ficam entre o cabeçalho e o item real, exigindo
 * a segunda tentativa de `resolveConsorcio` — a janela estreita ao redor do
 * item sozinho nunca alcança o "poderão disputar" do cabeçalho).
 */
const TRECHO_SANTACRUZ_CONSORCIO_CABECALHO_LONGE = `3.8 - Não poderão disputar esta licitação:
3.8.1 - aquele que não atenda às condições deste Edital e seu(s) anexo(s);
3.8.2 - autor do anteprojeto, do projeto básico ou do projeto executivo,
pessoa física ou jurídica, quando a licitação versar sobre serviços ou
fornecimento de bens a ele relacionados;
3.8.2.1 - equiparam-se aos autores do projeto as empresas integrantes do
mesmo grupo econômico.
3.8.3 - empresa, isoladamente ou em consórcio, responsável pela elaboração
do projeto básico ou do projeto executivo, ou empresa da qual o autor do
projeto seja dirigente, gerente, controlador, acionista ou detentor de mais
de 5% (cinco por cento) do capital com direito a voto, responsável técnico
ou subcontratado, quando a licitação versar sobre serviços ou fornecimento
de bens a ela necessários;
3.8.4 - pessoa física ou jurídica que se encontre, ao tempo da licitação,
impossibilitada de participar da licitação em decorrência de sanção que lhe
foi imposta;
3.8.9 - pessoas jurídicas reunidas em consórcio; 3.8.10 – Organizações da
Sociedade Civil de Interesse Público - OSCIP, atuando nessa condição.`;

/**
 * Trechos verdadeiros do edital de Camaquá/RS (Concorrência 16/2026) —
 * terceiro município testado. Espaços soltos no meio de palavra ("fornecid
 * o(s)", "term os") são artefato real do pdfjs-dist neste PDF, mantidos como
 * saíram.
 */
const TRECHO_CAMAQUA_CAT_VEDACAO_DE_SUBSTITUICAO = `d)   Atestados e Certidão de Acervo Técnico (CAT): Atestado(s) fornecid
o(s) por pessoa(s) jurídica(s)  de direito público ou privado, comprovando a execução de serviços
similares e compatíveis com o  objeto da licitação, devidamente certificado(s) no CREA e/ou CAU
e/ou CFT, acompanhado(s) da  CAT do responsável técnico, nos term os do parágrafo primeiro do
art. 67 da Lei nº 14.133/2021 ,  apresentando quantitativos mínimos de 50% dos objetos de maior re
levância técnica e econômica .  Vedada a substituição por qualquer outro documento.`;

/**
 * "Isoladamente ou em consórcio" aqui descreve COMO o autor do projeto pode
 * estar organizado — a exclusão é por conflito de interesse (ser autor do
 * projeto, Lei 14.133 art. 14), não por ser consórcio. As duas únicas
 * menções a "consórcio" no edital real de Camaquá/RS eram desta cláusula —
 * o documento não declara política nenhuma sobre consórcio em si.
 */
const TRECHO_CAMAQUA_CONSORCIO_APENAS_QUALIFICADOR = `4)   Declaramos, que em cumprimento do artigo 14 da Lei 14.133/21 que a nossa empresa não
poderá disputar licitação ou participar da execução de contrato, direta ou indiretamente nas
seguintes hipóteses: o autor do a nteprojeto, do projeto básico ou do projeto executivo, pessoa física
ou jurídica, quando a licitação   versar   sobre obra,   serviços   ou fornecimento de bens a ele
relacionados; a empresa isoladamente ou em consórcio, responsável pela elaboração do projeto
bási co ou do projeto executivo, ou empresa da qual o autor do projeto seja dirigente, gerente,
controlador, acionista ou detentor de mais de 5% (cinco por cento) do capital com direito a voto,
responsável   técnico   ou   subcontratado,   quando   a   licitação   versar   sobre   serviços   ou
fornecimento de bens a ela necessários.`;

describe("cláusulas institucionais, achadas no edital real de Pedra Preta/MT", () => {
  it("reconhece a vedação de consórcio pelo substantivo, não só pelo adjetivo", () => {
    const r = extractInstitutionalRequirement(TRECHO_CONSORCIO);
    expect(r.consortiumAllowed).toBe(false);
  });

  it("não deixa 'admitir consórcios' (da jurisprudência citada) sobrescrever a vedação", () => {
    // A citação do acórdão do TCU vem DEPOIS da vedação, no mesmo trecho, e
    // usa a palavra oposta ("admitir") para explicar o poder geral da lei —
    // não para dizer que aqui se admite.
    const r = extractInstitutionalRequirement(TRECHO_CONSORCIO);
    expect(r.consortiumAllowed).toBe(false);
    expect(r.limitations).not.toContain(expect.stringContaining("consórcio"));
  });

  it("reconhece CAT/CREA/CAU pela presença do termo, mesmo sem frase de sim/não explícita", () => {
    const r = extractInstitutionalRequirement(TRECHO_CAT);
    expect(r.requiresCat).toBe(true);
  });

  it("reconhece visita técnica facultativa por 'poderá declinar'", () => {
    const r = extractInstitutionalRequirement(TRECHO_VISITA);
    expect(r.requiresSiteVisit).toBe(false);
  });

  it("declara limitação, nunca palpite, quando a cláusula não aparece no texto", () => {
    const r = extractInstitutionalRequirement("Texto qualquer sem nenhuma das três cláusulas.");
    expect(r.consortiumAllowed).toBeUndefined();
    expect(r.requiresSiteVisit).toBeUndefined();
    // CAT é o único com viés: ausência de menção também não é dito "não exige"
    // — o padrão (quase universal em obra pública) é assumir que exige.
    expect(r.requiresCat).toBe(true);
    expect(r.limitations.length).toBeGreaterThan(0);
  });
});

describe("cláusulas institucionais, achadas no edital real de Santa Cruz do Sul/RS", () => {
  it("acha a vedação de consórcio no cabeçalho da lista, mesmo com o item bem mais adiante", () => {
    // A janela estreita ao redor de "consórcio" (item 3.8.9) não alcança o
    // "Não poderão disputar" do cabeçalho — só a segunda tentativa acha.
    const r = extractInstitutionalRequirement(TRECHO_SANTACRUZ_CONSORCIO_CABECALHO_LONGE);
    expect(r.consortiumAllowed).toBe(false);
    expect(r.limitations).not.toContain(expect.stringContaining("consórcio"));
  });
});

describe("cláusulas institucionais, achadas no edital real de Camaquá/RS", () => {
  it("não deixa 'vedada a substituição [do documento]' virar 'CAT não exigido'", () => {
    // A vedação aqui é sobre TROCAR o atestado por outro documento, não
    // sobre a exigência do CAT em si — sem o filtro, "vedad" da frase
    // errada ganhava de qualquer sinal positivo antes dele.
    const r = extractInstitutionalRequirement(TRECHO_CAMAQUA_CAT_VEDACAO_DE_SUBSTITUICAO);
    expect(r.requiresCat).toBe(true);
  });

  it("não confunde 'consórcio' como qualificador de OUTRA exclusão (autor do projeto) com vedação de consórcio em si", () => {
    // O cabeçalho "não poderá disputar" está logo ali, mas governa a
    // exclusão do AUTOR DO PROJETO — "consórcio" só qualifica como esse
    // autor pode estar organizado. Sem o filtro, isto virava "vedado" por
    // engano; o documento na verdade não fala nada sobre consórcio em si.
    const r = extractInstitutionalRequirement(TRECHO_CAMAQUA_CONSORCIO_APENAS_QUALIFICADOR);
    expect(r.consortiumAllowed).toBeUndefined();
    expect(r.limitations.some((l) => l.includes("consórcio"))).toBe(true);
  });
});

describe("seção de parcelas de maior relevância", () => {
  it("acha a seção técnico-operacional pelo título, não por menção de passagem", () => {
    expect(extractRelevantServicesSection(TRECHO_MENCAO_DE_PASSAGEM)).toBeUndefined();
    expect(extractRelevantServicesSection(TRECHO_JUSTIFICATIVA)).toBeDefined();
  });

  it("extrai as parcelas com a quantidade EXIGIDA (após o 100%), não a orçada", () => {
    const r = editalRequirementFromText(TRECHO_JUSTIFICATIVA);
    expect(r.services).toHaveLength(2);
    // 40% de 295,83 m³ = 118,33 — é a exigida que decide habilitação, não o
    // valor orçado (295,83) que aparece antes do "100%".
    expect(r.services[0]?.quantity).toBeCloseTo(118.33, 1);
    expect(r.services[0]?.unit).toBe("m3");
    expect(r.services[1]?.quantity).toBeCloseTo(450.38, 1);
  });

  it("tolera o espaço solto no meio do percentual ('4 0%' em vez de '40%') — artefato do PDF de origem", () => {
    const trecho = TRECHO_JUSTIFICATIVA; // já contém "4 0%", não "40%"
    const r = editalRequirementFromText(trecho);
    expect(r.services.length).toBeGreaterThan(0);
  });

  it("extrai a lista com marcador do edital real de Santa Cruz do Sul/RS — formato bem diferente do de Pedra Preta", () => {
    const r = editalRequirementFromText(TRECHO_SANTACRUZ_LISTA_PARCELAS);
    expect(r.services).toHaveLength(3);
    // Quantidade e unidade vêm GRUDADAS no original ("656,95m²") — e "m²"
    // precisa manter o expoente na unidade normalizada, não virar "m" solto.
    expect(r.services[0]?.quantity).toBeCloseTo(656.95, 1);
    expect(r.services[0]?.unit).toBe("m2");
    expect(r.services[1]?.quantity).toBeCloseTo(135.33, 1);
    expect(r.services[1]?.unit).toBe("m3");
    expect(r.services[2]?.quantity).toBeCloseTo(103, 1);
    expect(r.services[2]?.unit).toBe("m");
  });

  it("não confunde a seção técnico-PROFISSIONAL (sem quantitativo mínimo) com a operacional", () => {
    const soProfissional = `b) Qualificação Técnico - Profissional – Art. 67, I da Lei 14.133/2021
    Exige-se profissional de nível superior em engenharia civil e atestado de
    responsabilidade técnica com CAT, sem exigência de quantitativo mínimo.
    ITENS DESCRIÇÃO DOS SERVIÇOS QUANTIDADE ORÇADA PERCENTUAL ORÇADO 1
    EXECUÇÃO DE PASSEIO 95,83 M³ 100% EXPERIÊNCIA COMPROVADA ATRAVÉS DE
    ACERVO TÉCNICO SEM LIMITE DE QUANTIDADE -`;
    expect(extractRelevantServicesSection(soProfissional)).toBeUndefined();
  });
});

describe("o que não é extraído fica como limitação declarada, nunca vira exigência", () => {
  it("nenhuma parcela encontrada gera limitação, com lista de serviços vazia", () => {
    const r = editalRequirementFromText("Um edital qualquer sem a seção de qualificação técnico-operacional.");
    expect(r.services).toEqual([]);
    expect(r.limitations.some((l) => l.includes("parcelas de maior relevância"))).toBe(true);
  });
});

describe("garantia de proposta não é extraída de propósito", () => {
  /**
   * "Garantia de proposta" e "garantia de execução contratual" são exigências
   * diferentes — a segunda é comum e não responde à mesma pergunta. Um texto
   * que só menciona garantia de execução não pode virar resposta sobre
   * garantia de PROPOSTA.
   */
  it("EditalRequirement não tem campo para isto — o texto não é lido para tentar adivinhar", () => {
    const r = editalRequirementFromText("14.1. Garantia de execução contratual, no valor de 5%, do valor global.");
    expect(r).not.toHaveProperty("proposalGuarantee");
  });
});
