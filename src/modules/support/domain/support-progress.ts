export type SupportProgressInput = Readonly<{
  status: string;
  resolutionAttempts: number;
  updatedAt: string;
}>;

export type SupportProgress = Readonly<{
  attempt: number;
  headline: string;
  description: string;
  nextStep: string;
  tone: "blue" | "cyan" | "amber" | "green" | "rose" | "slate";
  stage: 1 | 2 | 3 | 4;
}>;

export function supportProgress(input: SupportProgressInput): SupportProgress {
  const deliveredAttempt = Math.max(0, input.resolutionAttempts);
  const nextAttempt = Math.min(3, deliveredAttempt + 1);
  if (input.status === "TRIAGED" || input.status === "APPROVED") return {
    attempt: nextAttempt,
    headline: deliveredAttempt > 0 ? "Reabertura aceita" : "Solicitação aceita",
    description: `As informações foram recebidas. A IA executará automaticamente a tentativa ${nextAttempt} de 3, sem depender de nova aprovação.`,
    nextStep: "Próximo passo: a IA analisará as evidências, corrigirá, testará e implantará uma nova versão.",
    tone: "blue", stage: 2,
  };
  if (input.status === "IN_PROGRESS") return {
    attempt: nextAttempt,
    headline: `IA trabalhando · tentativa ${nextAttempt} de 3`,
    description: "A correção está sendo preparada, validada e encaminhada para implantação automática.",
    nextStep: "Próximo passo: após a implantação, você receberá a solicitação para testar a solução.",
    tone: "cyan", stage: 3,
  };
  if (input.status === "WAITING_USER_VALIDATION") return {
    attempt: Math.max(1, deliveredAttempt),
    headline: `Sua validação é necessária · tentativa ${Math.max(1, deliveredAttempt)} de 3`,
    description: "A IA concluiu e implantou uma solução. Repita a operação que apresentou o problema.",
    nextStep: "Próximo passo: informe se o problema foi resolvido; se não, a IA coletará dados e tentará novamente.",
    tone: "amber", stage: 4,
  };
  if (input.status === "ESCALATED") return {
    attempt: 3,
    headline: "Escalado após três tentativas",
    description: "A automação concluiu as três tentativas sem confirmação de solução.",
    nextStep: "Próximo passo: o proprietário assumirá a análise excepcional deste chamado.",
    tone: "rose", stage: 4,
  };
  if (input.status === "RESOLVED") return {
    attempt: Math.max(1, deliveredAttempt),
    headline: "Chamado concluído com êxito",
    description: "O solicitante confirmou que o problema foi resolvido.",
    nextStep: "Nenhuma ação adicional é necessária.",
    tone: "green", stage: 4,
  };
  if (input.status === "WAITING_APPROVAL") return {
    attempt: nextAttempt,
    headline: "Migrando para execução automática",
    description: "Este registro é anterior à regra de autonomia e será encaminhado automaticamente.",
    nextStep: "Próximo passo: entrada na fila automática, sem ação do solicitante.",
    tone: "blue", stage: 2,
  };
  if (input.status === "REJECTED" || input.status === "CANCELLED") return {
    attempt: Math.max(1, deliveredAttempt), headline: "Chamado encerrado", description: "O atendimento não está mais ativo.", nextStep: "Abra um novo chamado se precisar retomar o assunto.", tone: "slate", stage: 4,
  };
  return {
    attempt: nextAttempt, headline: "Solicitação recebida", description: "O chamado foi registrado e está sendo analisado pela IA.", nextStep: "Próximo passo: diagnóstico e entrada automática na fila técnica.", tone: "blue", stage: 1,
  };
}
