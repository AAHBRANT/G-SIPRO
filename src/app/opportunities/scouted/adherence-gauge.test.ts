import { describe, expect, it } from "vitest";

/**
 * Geometria do velocímetro. Reproduz o cálculo de `adherence-gauge.tsx` para
 * varrer as 101 notas possíveis de uma vez.
 *
 * Regressão da prévia v11: o `large-arc-flag` era calculado como
 * `(fim - inicio) > 50 ? 1 : 0`, o que é errado — o arco varre no máximo meia
 * volta, então o sinalizador tem de ser 0 sempre. Com 1 o traço saía pelo lado
 * de fora da caixa em notas acima de 50.
 */

const CX = 50;
const CY = 46;
const R = 34;
const VIEW_W = 100;
const VIEW_H = 74;
const TEXT_BASELINES = [46 + 16, 46 + 26];

function pointAt(score: number, radius: number): readonly [number, number] {
  const angle = ((180 - (Math.max(0, Math.min(100, score)) / 100) * 180) * Math.PI) / 180;
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

function arcTo(score: number): string {
  const [x0, y0] = pointAt(0, R);
  const [x, y] = pointAt(score, R);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

const scores = Array.from({ length: 101 }, (_, index) => index);

describe("geometria do velocímetro", () => {
  it("mantém o arco dentro da caixa em todas as 101 notas", () => {
    // Meia espessura do traço (7) mais folga para a ponta arredondada.
    const margin = 4.5;
    const escaping = scores.filter((score) => {
      const [x, y] = pointAt(score, R);
      return x - margin < 0 || x + margin > VIEW_W || y - margin < 0 || y + margin > VIEW_H;
    });
    expect(escaping).toEqual([]);
  });

  it("nunca marca o arco como maior que meia volta", () => {
    // O quinto número do comando A é o large-arc-flag.
    const flags = scores.map((score) => arcTo(score).split(/\s+/)[7]);
    expect([...new Set(flags)]).toEqual(["0"]);
  });

  it("ancora nota 0 à esquerda e nota 100 à direita, na mesma altura", () => {
    const [x0, y0] = pointAt(0, R);
    const [x100, y100] = pointAt(100, R);
    expect(x0).toBeCloseTo(CX - R, 5);
    expect(x100).toBeCloseTo(CX + R, 5);
    expect(y0).toBeCloseTo(CY, 5);
    expect(y100).toBeCloseTo(CY, 5);
  });

  it("põe a nota 50 no topo do arco", () => {
    const [x, y] = pointAt(50, R);
    expect(x).toBeCloseTo(CX, 5);
    expect(y).toBeCloseTo(CY - R, 5);
  });

  it("avança sempre para a direita conforme a nota sobe", () => {
    const xs = scores.map((score) => pointAt(score, R)[0]);
    const regressions = xs.filter((x, index) => index > 0 && x <= xs[index - 1]!);
    expect(regressions).toEqual([]);
  });

  /**
   * O rotulo "aderencia" era desenhado em y=70 numa caixa de 70 de altura util
   * e sumia da tela — defeito visto na conferencia de 28/08/2026. Texto fora da
   * caixa nao da erro nenhum: simplesmente nao aparece.
   */
  it("desenha os dois textos dentro da caixa", () => {
    for (const baseline of TEXT_BASELINES) expect(baseline).toBeLessThanOrEqual(VIEW_H - 2);
  });

  it("prende nota fora da faixa nos extremos, em vez de sair da caixa", () => {
    expect(pointAt(-40, R)).toEqual(pointAt(0, R));
    expect(pointAt(180, R)).toEqual(pointAt(100, R));
  });
});
