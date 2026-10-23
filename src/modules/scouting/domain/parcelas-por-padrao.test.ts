import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { editalRequirementFromText } from "@/modules/scouting/domain/edital-text-requirement";
import {
  limparTexto,
  numeroBR,
  parcelasEmFrase,
  parcelasEmListaComDoisPontos,
  parcelasEmTabelaAchatada,
  parcelasPorPadrao,
} from "@/modules/scouting/domain/parcelas-por-padrao";

/**
 * Trechos REAIS de editais de obra abertos no PNCP em out/2026 (a mesma fila
 * do Buscador), com a exigência que uma pessoa leu em cada um. É contra eles
 * que o leitor foi ensinado — e é por eles que ele não pode desaprender.
 */
type Caso = Readonly<{ id: string; licitacao: string; texto: string; esperado: readonly { quantity: number; unit: string; description: string }[] }>;
const CASOS: readonly Caso[] = JSON.parse(readFileSync(join(__dirname, "__fixtures__", "parcelas-de-editais-reais.json"), "utf8"));

const mesmaUnidade = (a?: string, b?: string) => (a ?? "").toLowerCase().replace("2", "²").replace("3", "³") === (b ?? "").toLowerCase().replace("2", "²").replace("3", "³");

/** Lê o trecho isolado como a janela faria (o trecho já é a seção). */
function ler(texto: string) {
  const janela = limparTexto(texto);
  const porJanela = [parcelasEmFrase(janela), parcelasEmListaComDoisPontos(janela), parcelasEmTabelaAchatada(janela)]
    .find((lista) => lista.length > 0 && lista.length <= 14) ?? [];
  const inteiro = parcelasPorPadrao(texto);
  return inteiro.length >= porJanela.length ? inteiro : porJanela;
}

describe("parcelas de maior relevância em editais reais", () => {
  const resultados = CASOS.map((caso) => {
    const lidas = ler(caso.texto);
    const acertos = caso.esperado.filter((e) => lidas.some((l) => Math.abs((l.quantity ?? -1) - e.quantity) < 0.011 && mesmaUnidade(l.unit, e.unit))).length;
    const aMais = lidas.filter((l) => !caso.esperado.some((e) => Math.abs((l.quantity ?? -1) - e.quantity) < 0.011)).length;
    return { caso, acertos, aMais };
  });

  it("acha ao menos 95% das parcelas exigidas, com a quantidade MÍNIMA e a unidade certas", () => {
    const esperadas = resultados.reduce((s, r) => s + r.caso.esperado.length, 0);
    const acertos = resultados.reduce((s, r) => s + r.acertos, 0);
    expect(acertos / esperadas).toBeGreaterThanOrEqual(0.95);
  });

  it("quase nunca inventa parcela: no máximo 3 a mais em 40 editais", () => {
    expect(resultados.reduce((s, r) => s + r.aMais, 0)).toBeLessThanOrEqual(3);
  });

  it.each(["F1a", "F1d", "F2a", "F3c", "F4c", "F5a", "F6a", "F7a", "F8a", "F9a", "F10a", "F10b"])("%s: lê todas as parcelas do formato", (id) => {
    const r = resultados.find((x) => x.caso.id === id)!;
    expect(r.acertos).toBe(r.caso.esperado.length);
  });
});

describe("regras que o corpus ensinou", () => {
  it("tabela com total e mínimo: vale o mínimo (2º número), não o total", () => {
    const lidas = parcelasEmTabelaAchatada("Execução de rede de drenagem pluvial com tubos de concreto armado 2.449,77 m 979,91 m Execução de pavimentação em concreto asfáltico 11.000,00 m² 4.400,00 m²");
    expect(lidas.map((l) => [l.quantity, l.unit])).toEqual([[979.91, "m"], [4400, "m²"]]);
  });

  it("quadro do DNIT: vale o número depois de ≥", () => {
    const lidas = parcelasEmTabelaAchatada("4 Execução de Serviços de Restauração e/ou Recuperação em Rodovias Pavimentadas 98,90 km ext ≥ 49,00 km");
    expect(lidas).toEqual([expect.objectContaining({ quantity: 49, unit: "km" })]);
  });

  it("medida que descreve o serviço não vira parcela: 'DMT ATÉ 30 KM', 'D = 2,60 M'", () => {
    const lidas = parcelasEmTabelaAchatada("TRANSPORTE COM CAMINHÃO BASCULANTE EM VIA URBANA PAVIMENTADA, DMT ATÉ 30 KM BUEIRO METÁLICO - D = 2,60 M - CHAPA GALVANIZADA M 208,40 63,00 (30%)");
    expect(lidas.map((l) => l.quantity)).toEqual([63]);
  });

  it("'interno mínimo de 3,00 m' não é 'no mínimo'", () => {
    expect(parcelasEmFrase("galeria fechada para drenagem pluvial, com perímetro interno mínimo de 3,00 m")).toEqual([]);
  });

  it("frase com 'não inferior a' pega a parcela e não a característica", () => {
    const lidas = parcelasEmFrase("c) EXECUÇÃO DE GALERIA RETANGULAR DE CONCRETO ARMADO, COM ÁREA MÍNIMA DA SEÇÃO DE CONCRETO DE 1,2M², FCK MÍNIMO DE 20MPA EM QUANTIDADE NÃO INFERIOR A 490,00 M;");
    expect(lidas).toEqual([expect.objectContaining({ quantity: 490, unit: "m" })]);
  });

  it("fora da seção de qualificação técnica, nada é lido — nem planilha orçamentária", () => {
    expect(parcelasPorPadrao("PLANILHA ORÇAMENTÁRIA 1.1 Escavação mecanizada m³ 1.200,00 1.2 Concreto fck 25 MPa m³ 340,00 1.3 Forma de madeira m² 2.100,00")).toEqual([]);
  });

  it("número brasileiro: milhar com ponto e decimal com vírgula", () => {
    expect(numeroBR("1.792,41")).toBe(1792.41);
    expect(numeroBR("7.219")).toBe(7219);
    expect(numeroBR("86.412,412")).toBe(86412.412);
  });

  it("o leitor do edital usa o padrão novo só quando os formatos antigos não acharam nada", () => {
    const r = editalRequirementFromText("9.1 Qualificação técnico-operacional: atestado de execução de pavimentação asfáltica em quantidade não inferior a 4.400,00 m²;");
    expect(r.services).toEqual([expect.objectContaining({ quantity: 4400, unit: "m²" })]);
    expect(r.limitations.some((l) => l.includes("confira os quantitativos"))).toBe(true);
  });
});
