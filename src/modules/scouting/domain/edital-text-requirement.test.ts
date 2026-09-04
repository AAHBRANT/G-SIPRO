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
