// Funções e rótulos puros compartilhados entre o painel de Oportunidade ("use client",
// em intelligence-panel.tsx) e a análise herdada, só leitura, da Proposta (Server Component).
// Precisam viver fora de um módulo "use client" — chamar uma função de lá diretamente
// num Server Component não é permitido pelo React/Next.

export type Perspective = "ALL" | "COMMERCIAL" | "TECHNICAL" | "STUDIES";

export const perspectiveLabels: Record<Perspective, string> = {
  ALL: "Visão consolidada",
  COMMERCIAL: "Comercial",
  TECHNICAL: "Capacidade técnica",
  STUDIES: "Estudos e praticabilidade",
};

export const recommendationLabels: Record<string, string> = {
  RECOMMENDED: "Recomendado",
  RECOMMENDED_WITH_RESERVATIONS: "Recomendado com ressalvas",
  NOT_RECOMMENDED: "Não recomendado",
  WAITING_INFORMATION: "Aguardando informações",
  WAITING_OWNER_DECISION: "Aguardando decisão",
};

export const recommendationTone: Record<string, string> = {
  RECOMMENDED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  RECOMMENDED_WITH_RESERVATIONS: "border-amber-200 bg-amber-50 text-amber-800",
  NOT_RECOMMENDED: "border-red-200 bg-red-50 text-red-800",
  WAITING_INFORMATION: "border-blue-200 bg-blue-50 text-blue-800",
  WAITING_OWNER_DECISION: "border-violet-200 bg-violet-50 text-violet-800",
};

export function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

export function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function scoreTone(value: number | null) {
  if (value === null) return "text-slate-500";
  if (value >= 75) return "text-emerald-700";
  if (value >= 50) return "text-amber-700";
  return "text-red-700";
}
