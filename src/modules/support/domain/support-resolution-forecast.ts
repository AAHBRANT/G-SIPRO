export type SupportResolutionForecastInput = Readonly<{
  status: string;
  priority: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  executionClaimedAt?: string | null;
  executionAttempts?: number;
  resolvedAt?: string | null;
}>;

export type SupportResolutionForecast = Readonly<{
  state: "ON_TRACK" | "OVERDUE" | "WAITING" | "DONE";
  estimateAt: string | null;
  elapsedMinutes: number;
  remainingMinutes: number | null;
  responsible: "IA do G-SIPRO" | "Proprietário" | "Solicitante" | "Concluído";
  headline: string;
  explanation: string;
}>;

const priorityMinutes: Record<string, number> = {
  CRITICAL: 20,
  HIGH: 30,
  NORMAL: 45,
};

const typeMinutes: Record<string, number> = {
  QUESTION: -10,
  BUG: 0,
  IMPROVEMENT: 20,
  NEW_FEATURE: 40,
};

function validDate(value: string | null | undefined, fallback: Date) {
  const parsed = value ? new Date(value) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function waitingForecast(
  input: SupportResolutionForecastInput,
  now: Date,
  responsible: "Proprietário" | "Solicitante",
  headline: string,
  explanation: string,
): SupportResolutionForecast {
  const createdAt = validDate(input.createdAt, now);
  return {
    state: "WAITING",
    estimateAt: null,
    elapsedMinutes: Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60_000)),
    remainingMinutes: null,
    responsible,
    headline,
    explanation,
  };
}

export function supportResolutionForecast(
  input: SupportResolutionForecastInput,
  now = new Date(),
): SupportResolutionForecast {
  const createdAt = validDate(input.createdAt, now);
  const updatedAt = validDate(input.updatedAt, createdAt);
  const completionAt = validDate(input.resolvedAt ?? input.updatedAt, updatedAt);
  const elapsedEnd = ["RESOLVED", "REJECTED", "CANCELLED"].includes(input.status) ? completionAt : now;
  const elapsedMinutes = Math.max(0, Math.floor((elapsedEnd.getTime() - createdAt.getTime()) / 60_000));

  if (["RESOLVED", "REJECTED", "CANCELLED"].includes(input.status)) {
    return {
      state: "DONE",
      estimateAt: null,
      elapsedMinutes,
      remainingMinutes: null,
      responsible: "Concluído",
      headline: input.status === "RESOLVED" ? "Atendimento concluído" : "Atendimento encerrado",
      explanation: "O tempo apresentado corresponde ao período entre a abertura e o encerramento registrado.",
    };
  }

  if (input.status === "WAITING_APPROVAL") {
    return waitingForecast(input, now, "Proprietário", "Aguardando aprovação", "A estimativa da IA será retomada assim que o proprietário aprovar ou rejeitar a solicitação.");
  }
  if (input.status === "OWNER_ACTION_REQUIRED") {
    return waitingForecast(input, now, "Proprietário", "Aguardando ação administrativa", "A previsão está pausada até a confirmação da ação externa indicada no chamado.");
  }
  if (input.status === "ESCALATED") {
    return waitingForecast(input, now, "Proprietário", "Aguardando tratamento excepcional", "As três tentativas automáticas terminaram e o proprietário precisa assumir a exceção.");
  }
  if (input.status === "WAITING_USER_VALIDATION") {
    return waitingForecast(input, now, "Solicitante", "Aguardando validação", "A solução foi entregue; o prazo da IA está pausado enquanto o solicitante confirma o resultado.");
  }

  const baseMinutes = Math.max(10, (priorityMinutes[input.priority] ?? priorityMinutes.NORMAL) + (typeMinutes[input.type] ?? 0));
  const attemptAdjustment = Math.max(0, (input.executionAttempts ?? 0) - 1) * 15;
  const queueMinutes = input.status === "IN_PROGRESS" ? 0 : 10;
  const anchor = input.status === "IN_PROGRESS"
    ? validDate(input.executionClaimedAt, updatedAt)
    : updatedAt;
  const estimate = new Date(anchor.getTime() + (baseMinutes + attemptAdjustment + queueMinutes) * 60_000);
  const remainingMinutes = Math.ceil((estimate.getTime() - now.getTime()) / 60_000);
  const overdue = remainingMinutes < 0;

  return {
    state: overdue ? "OVERDUE" : "ON_TRACK",
    estimateAt: estimate.toISOString(),
    elapsedMinutes,
    remainingMinutes,
    responsible: "IA do G-SIPRO",
    headline: overdue ? "Previsão excedida" : input.status === "IN_PROGRESS" ? "Correção em execução" : "Atendimento programado",
    explanation: overdue
      ? "A estimativa operacional foi ultrapassada. O chamado continua aberto e deve receber uma atualização ou escalonamento."
      : "Estimativa calculada pela prioridade, tipo, tentativa atual e etapa do atendimento automático.",
  };
}
