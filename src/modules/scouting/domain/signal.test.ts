import { describe, expect, it } from "vitest";

import { contrast, resolveSignal, signalCommandSchema, suggestedColors, themeVariants } from "@/modules/scouting/domain/signal";

/** Mesmo empilhamento de camadas que o domínio usa para medir a etiqueta. */
const surfaces = { light: "#ffffff", dark: "#191717" } as const;
const toRgb = (hex: string) => [0, 2, 4].map((i) => Number.parseInt(hex.replace("#", "").slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
const layer = (front: string, alpha: number, back: string) => {
  const f = toRgb(front);
  const b = toRgb(back);
  return toHex(f.map((v, i) => v * alpha + b[i]! * (1 - alpha)));
};
const chipBackground = (color: string, theme: keyof typeof surfaces) =>
  layer(color, 0.16, layer(color, 0.07, surfaces[theme]));

describe("signalCommandSchema", () => {
  it("aceita os três níveis fixos sem exigir nome nem cor", () => {
    expect(signalCommandSchema.parse({ level: "HIGH" })).toEqual({ level: "HIGH" });
  });

  it("recusa sinalização livre sem nome", () => {
    expect(() => signalCommandSchema.parse({ level: "CUSTOM", color: "#123456" })).toThrow();
  });

  it("recusa nome de uma letra: não diz nada a quem lê a fila", () => {
    expect(() => signalCommandSchema.parse({ level: "CUSTOM", label: "x", color: "#123456" })).toThrow();
  });

  it("recusa cor fora do formato #RRGGBB", () => {
    for (const color of ["vermelho", "#fff", "#12345", "rgb(1,2,3)"]) {
      expect(() => signalCommandSchema.parse({ level: "CUSTOM", label: "acervo", color })).toThrow();
    }
  });

  it("aceita a sinalização livre completa", () => {
    const parsed = signalCommandSchema.parse({ level: "CUSTOM", label: "  aguardando acervo  ", color: "#6B3FA0" });
    expect(parsed).toMatchObject({ level: "CUSTOM", label: "aguardando acervo", color: "#6B3FA0" });
  });
});

describe("resolveSignal", () => {
  it("dá rótulo e cor próprios a cada nível fixo", () => {
    const níveis = (["HIGH", "MEDIUM", "LOW"] as const).map((level) => resolveSignal({ level }));
    expect(níveis.map((s) => s.label)).toEqual(["Prioridade alta", "Prioridade média", "Prioridade baixa"]);
    expect(new Set(níveis.map((s) => s.color)).size).toBe(3);
  });

  it("guarda a cor escolhida na sinalização livre", () => {
    const signal = resolveSignal({ level: "CUSTOM", label: "aguardando acervo", color: "#6B3FA0" });
    expect(signal.color).toBe("#6b3fa0");
    expect(signal.label).toBe("aguardando acervo");
  });

  it("grava toda cor em minúscula, venha do nível fixo ou da escolha livre", () => {
    // Duas grafias da mesma cor quebrariam a comparação com a paleta sugerida.
    const fixa = resolveSignal({ level: "HIGH" }).color;
    const livre = resolveSignal({ level: "CUSTOM", label: "roxo", color: "#6B3FA0" }).color;
    expect(fixa).toBe(fixa.toLowerCase());
    expect(livre).toBe(livre.toLowerCase());
  });

  it("preserva a observação quando ela vem, e não inventa uma quando não vem", () => {
    expect(resolveSignal({ level: "HIGH", note: "conferir consórcio" }).note).toBe("conferir consórcio");
    expect(resolveSignal({ level: "HIGH" }).note).toBeUndefined();
  });
});

describe("legibilidade da cor nos dois temas", () => {
  /**
   * O ponto central. A primeira versão desta regra prendia a luminosidade do
   * HSL — 40% no claro, 70% no escuro — e falhava justamente no amarelo, que a
   * 40% ainda rende 2,19:1 sobre branco. Estes casos existem para a regra nunca
   * voltar a ser um atalho.
   */
  const dificeis = ["#F2C200", "#8FE36B", "#111111", "#FFFFFF", "#00FF00", "#FFFF00", "#0000FF"];

  it.each([...suggestedColors, ...dificeis])("%s fica legível nos dois temas", (color) => {
    const signal = resolveSignal({ level: "CUSTOM", label: "teste", color });
    expect(contrast(signal.light, chipBackground(signal.light, "light"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(signal.dark, chipBackground(signal.dark, "dark"))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["HIGH", "MEDIUM", "LOW"] as const)("o nível %s também passa nos dois temas", (level) => {
    const signal = resolveSignal({ level });
    expect(contrast(signal.light, chipBackground(signal.light, "light"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(signal.dark, chipBackground(signal.dark, "dark"))).toBeGreaterThanOrEqual(4.5);
  });

  it("o amarelo vivo é de fato alterado no tema claro", () => {
    // Se a regra virar um repasse da cor crua, este caso quebra.
    const signal = resolveSignal({ level: "CUSTOM", label: "amarelo", color: "#F2C200" });
    expect(signal.light).not.toBe("#f2c200");
    expect(contrast("#f2c200", chipBackground("#f2c200", "light"))).toBeLessThan(4.5);
  });

  it("themeVariants devolve o mesmo que resolveSignal, para a tela ler o que está gravado", () => {
    // A tela parte de uma sinalização já gravada e não deve remontar um comando
    // só para descobrir os tons.
    const doComando = resolveSignal({ level: "CUSTOM", label: "roxo", color: "#6B3FA0" });
    const doGravado = themeVariants("#6b3fa0");
    expect(doGravado).toEqual({ light: doComando.light, dark: doComando.dark });
  });

  it("as duas variantes de um mesmo tom não são iguais entre si", () => {
    const signal = resolveSignal({ level: "CUSTOM", label: "roxo", color: "#6B3FA0" });
    expect(signal.light).not.toBe(signal.dark);
  });

  it("preserva o matiz: a cor ajustada continua sendo da mesma família", () => {
    // Verde escolhido não pode sair vermelho do outro lado.
    const signal = resolveSignal({ level: "CUSTOM", label: "verde", color: "#8FE36B" });
    for (const tom of [signal.light, signal.dark]) {
      const [r, g, b] = toRgb(tom);
      expect(g!).toBeGreaterThan(r!);
      expect(g!).toBeGreaterThan(b!);
    }
  });
});
