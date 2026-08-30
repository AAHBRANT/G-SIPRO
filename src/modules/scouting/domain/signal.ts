import { z } from "zod";

/**
 * Sinalização de uma licitação rastreada: a marca colorida que a equipe finca
 * numa linha da fila para dizer o que fazer com ela.
 *
 * Três níveis fixos em semáforo — a convenção que a equipe já usa em planilha e
 * em diário de obra — mais um nível livre, em que a pessoa escreve o próprio
 * nome e escolhe a própria cor.
 */

export const signalLevels = ["HIGH", "MEDIUM", "LOW", "CUSTOM"] as const;
export type SignalLevel = (typeof signalLevels)[number];

/** Rótulo e cor de partida de cada nível fixo. */
const fixedLevels: Readonly<Record<Exclude<SignalLevel, "CUSTOM">, { label: string; color: string }>> = {
  HIGH: { label: "Prioridade alta", color: "#A31414" },
  MEDIUM: { label: "Prioridade média", color: "#8A6410" },
  LOW: { label: "Prioridade baixa", color: "#2E7D57" },
};

/** Cores sugeridas para a sinalização livre; o seletor do sistema cobre o resto. */
export const suggestedColors = [
  "#A31414", "#8A6410", "#2E7D57", "#1F5C8B",
  "#6B3FA0", "#B0430F", "#0E7C7B", "#670000",
] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "A cor deve estar no formato #RRGGBB.");

export const signalCommandSchema = z.discriminatedUnion("level", [
  z.object({
    level: z.enum(["HIGH", "MEDIUM", "LOW"]),
    note: z.string().trim().max(400).optional(),
  }).strict(),
  z.object({
    level: z.literal("CUSTOM"),
    // Sinalização livre sem nome é um borrão colorido: ninguém além de quem
    // marcou sabe o que ela quer dizer.
    label: z.string().trim().min(2, "Dê um nome à sinalização.").max(34),
    color: hexColor,
    note: z.string().trim().max(400).optional(),
  }).strict(),
]);

export type SignalCommand = z.infer<typeof signalCommandSchema>;

/* ------------------------------------------------------------------ *
 * Legibilidade da cor
 * ------------------------------------------------------------------ */

/** Superfície da linha em cada tema, antes de qualquer tingimento. */
const surfaces = { light: "#ffffff", dark: "#191717" } as const;
/** A etiqueta é a cor a 16% sobre a linha, que é a mesma cor a 7%. */
const rowWash = 0.07;
const chipWash = 0.16;
const minimumContrast = 4.6;

type Rgb = readonly [number, number, number];

const toRgb = (hex: string): Rgb => {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16)) as unknown as Rgb;
};

const toHex = (rgb: Rgb): string => `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;

const toHsl = ([red, green, blue]: Rgb): readonly [number, number, number] => {
  const [r, g, b] = [red / 255, green / 255, blue / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness * 100];

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [hue * 60, saturation * 100, lightness * 100];
};

const fromHsl = (hue: number, saturation: number, lightness: number): string => {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255;
  return toHex([channel(0), channel(8), channel(4)]);
};

const channelLuminance = (value: number) => {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

export const luminance = (hex: string): number => {
  const [r, g, b] = toRgb(hex).map(channelLuminance);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

export const contrast = (a: string, b: string): number => {
  const [brighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (brighter! + 0.05) / (darker! + 0.05);
};

const layer = (front: string, alpha: number, back: string): string => {
  const [fr, fg, fb] = toRgb(front);
  const [br, bg, bb] = toRgb(back);
  return toHex([fr * alpha + br * (1 - alpha), fg * alpha + bg * (1 - alpha), fb * alpha + bb * (1 - alpha)]);
};

/** Fundo real sob o texto da etiqueta, já com as duas camadas de tingimento. */
const chipBackground = (color: string, theme: keyof typeof surfaces): string =>
  layer(color, chipWash, layer(color, rowWash, surfaces[theme]));

/**
 * Escurece ou clareia a cor até ela alcançar o contraste mínimo contra o fundo
 * do tema, preservando matiz e saturação.
 *
 * ⚠️ Não use luminosidade de HSL como atalho. Amarelo a 40% de luminosidade
 * ainda rende 2,19:1 sobre branco, porque luminosidade de HSL não é brilho
 * percebido — o olho pesa o verde quase quatro vezes mais que o azul. O corte
 * tem de ser pelo contraste medido, que é o que a pessoa enxerga.
 */
function adjust(base: string, theme: keyof typeof surfaces): string {
  const [hue, saturation, start] = toHsl(toRgb(base));
  const step = theme === "dark" ? 2 : -2;
  for (let lightness = start!; lightness >= 0 && lightness <= 100; lightness += step) {
    const candidate = fromHsl(hue!, saturation!, lightness);
    if (contrast(candidate, chipBackground(candidate, theme)) >= minimumContrast) return candidate;
  }
  return theme === "dark" ? "#ffffff" : "#000000";
}

/**
 * Os dois tons de uma cor: o desenhado sobre fundo claro e o desenhado sobre
 * fundo escuro. É o que a tela precisa para trocar de tema sem recalcular nada
 * e sem consultar o banco de novo.
 */
export const themeVariants = (color: string): Readonly<{ light: string; dark: string }> => ({
  light: adjust(color, "light"),
  dark: adjust(color, "dark"),
});

export type ResolvedSignal = Readonly<{
  level: SignalLevel;
  label: string;
  /** Cor escolhida, como veio da pessoa ou do nível. */
  color: string;
  /** Tom desenhado sobre fundo claro. */
  light: string;
  /** Tom desenhado sobre fundo escuro. */
  dark: string;
  note?: string;
}>;

/**
 * Resolve o que fica gravado e o que vai para a tela. As duas variantes são
 * calculadas uma vez e viajam juntas: assim a troca de tema não precisa
 * recalcular nada, e nenhuma cor escolhida fica ilegível no outro tema.
 */
export function resolveSignal(command: SignalCommand): ResolvedSignal {
  // Sempre em minúscula: a mesma cor gravada em duas grafias quebraria
  // qualquer comparação — inclusive a que marca a cor escolhida na paleta.
  const color = (command.level === "CUSTOM" ? command.color : fixedLevels[command.level].color).toLowerCase();
  const label = command.level === "CUSTOM" ? command.label : fixedLevels[command.level].label;
  return {
    level: command.level,
    label,
    color,
    ...themeVariants(color),
    ...(command.note ? { note: command.note } : {}),
  };
}

/** Rótulo padrão de um nível fixo, para exibição fora do fluxo de gravação. */
export const labelOfLevel = (level: SignalLevel): string =>
  level === "CUSTOM" ? "Sinalização" : fixedLevels[level].label;

/**
 * Cor de partida de um nível fixo, para a TELA vestir cada botão de prioridade
 * com a própria cor. Sem isto o seletor pinta os três com o acento genérico —
 * vinho no claro, bege no escuro — e Alta, Média e Baixa ficam idênticas.
 */
export const colorOfLevel = (level: SignalLevel): string | undefined =>
  level === "CUSTOM" ? undefined : fixedLevels[level].color;
