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
  pendingSummary: string;
  nextActions: readonly SupportResolutionAction[];
}>;

export type SupportResolutionAction = Readonly<{
  label: string;
  detail: string;
  responsible: "IA do G-SIPRO" | "Proprietário" | "Solicitante";
  state: "CURRENT" | "UPCOMING";
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
  pendingSummary: string,
  nextActions: readonly SupportResolutionAction[],
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
    pendingSummary,
    nextActions,
  };
}

const validationAction: SupportResolutionAction = {
  label: "Validar a solução",
  detail: "Confirmar se o problema foi resolvido ou informar objetivamente o que ainda falhou.",
  responsible: "Solicitante",
  state: "UPCOMING",
};

function automaticActions(status: string): readonly SupportResolutionAction[] {
  if (status === "OPEN") return [
    {
      label: "Analisar e classificar o chamado",
      detail: "Ler a descrição e as evidências para definir o tratamento técnico.",
      responsible: "IA do G-SIPRO",
      state: "CURRENT",
    },
    {
      label: "Executar a correção",
      detail: "Preparar a alteração necessária conforme o diagnóstico.",
      responsible: "IA do G-SIPRO",
      state: "UPCOMING",
    },
    {
      label: "Testar e implantar",
      detail: "Validar a correção e publicar a nova versão do sistema.",
      responsible: "IA do G-SIPRO",
      state: "UPCOMING",
    },
    validationAction,
  ];

  if (status === "TRIAGED") return [
    {
      label: "Iniciar a execução técnica",
      detail: "Retirar o chamado da fila e aplicar o diagnóstico já registrado.",
      responsible: "IA do G-SIPRO",
      state: "CURRENT",
    },
    {
      label: "Testar e implantar",
      detail: "Validar a correção e publicar a nova versão do sistema.",
      responsible: "IA do G-SIPRO",
      state: "UPCOMING",
    },
    validationAction,
  ];

  if (status === "APPROVED") return [
    {
      label: "Iniciar a alteração aprovada",
      detail: "Aplicar automaticamente a melhoria autorizada.",
      responsible: "IA do G-SIPRO",
      state: "CURRENT",
    },
    {
      label: "Testar e implantar",
      detail: "Validar a alteração e publicar a nova versão do sistema.",
      responsible: "IA do G-SIPRO",
      state: "UPCOMING",
    },
    validationAction,
  ];

  return [
    {
      label: "Concluir a execução técnica",
      detail: "Finalizar a correção correspondente à tentativa atual.",
      responsible: "IA do G-SIPRO",
      state: "CURRENT",
    },
    {
      label: "Testar e implantar",
      detail: "Executar as validações e publicar a correção.",
      responsible: "IA do G-SIPRO",
      state: "UPCOMING",
    },
    validationAction,
  ];
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
      pendingSummary: "Nenhuma ação pendente.",
      nextActions: [],
    };
  }

  if (input.status === "WAITING_APPROVAL") {
    return waitingForecast(
      input,
      now,
      "Proprietário",
      "Aguardando aprovação",
      "Ainda não existe uma conclusão estimada porque a execução depende da decisão do proprietário. Após a aprovação, o sistema calculará uma nova previsão automaticamente.",
      "Falta a aprovação da alteração, a execução técnica, os testes, a implantação e a validação do solicitante.",
      [
        {
          label: "Aprovar ou rejeitar a alteração",
          detail: "Analisar o pedido funcional e registrar a decisão no G-SIPRO.",
          responsible: "Proprietário",
          state: "CURRENT",
        },
        ...automaticActions("APPROVED").map(action => ({ ...action, state: "UPCOMING" as const })),
      ],
    );
  }
  if (input.status === "OWNER_ACTION_REQUIRED") {
    return waitingForecast(
      input,
      now,
      "Proprietário",
      "Aguardando ação administrativa",
      "Ainda não existe uma conclusão estimada porque há uma ação protegida fora do alcance da IA. Após a confirmação do proprietário, o sistema retomará o chamado e recalculará a previsão.",
      "Falta concluir a ação administrativa indicada, retomar os testes e obter a validação do solicitante.",
      [
        {
          label: "Executar e confirmar a ação protegida",
          detail: "Realizar no ambiente indicado a ação administrativa descrita no chamado.",
          responsible: "Proprietário",
          state: "CURRENT",
        },
        {
          label: "Retomar, testar e implantar",
          detail: "Verificar a liberação, concluir a correção e publicar a versão.",
          responsible: "IA do G-SIPRO",
          state: "UPCOMING",
        },
        validationAction,
      ],
    );
  }
  if (input.status === "ESCALATED") {
    return waitingForecast(
      input,
      now,
      "Proprietário",
      "Aguardando tratamento excepcional",
      "As três tentativas automáticas terminaram. A conclusão dependerá do tratamento excepcional e uma nova previsão será registrada após a definição da solução.",
      "Falta o proprietário assumir a exceção, definir a solução, implantá-la e devolvê-la ao solicitante para validação.",
      [
        {
          label: "Assumir e direcionar a exceção",
          detail: "Analisar o histórico das três tentativas e definir como a correção será concluída.",
          responsible: "Proprietário",
          state: "CURRENT",
        },
        {
          label: "Executar a solução excepcional",
          detail: "Aplicar, testar e implantar a solução definida pelo proprietário.",
          responsible: "IA do G-SIPRO",
          state: "UPCOMING",
        },
        validationAction,
      ],
    );
  }
  if (input.status === "WAITING_USER_VALIDATION") {
    return waitingForecast(
      input,
      now,
      "Solicitante",
      "Aguardando validação",
      "A solução já foi entregue. O encerramento depende da confirmação do solicitante; se o problema continuar, a IA iniciará automaticamente uma nova tentativa.",
      "Falta apenas confirmar se a solução resolveu o problema ou informar o que ainda não funcionou.",
      [{ ...validationAction, state: "CURRENT" }],
    );
  }

  const nextActions = automaticActions(input.status);
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
    pendingSummary: input.status === "IN_PROGRESS"
      ? "Falta concluir a correção, executar os testes, implantar a versão e receber a validação do solicitante."
      : "Falta iniciar a execução técnica, testar, implantar e receber a validação do solicitante.",
    nextActions,
  };
}
