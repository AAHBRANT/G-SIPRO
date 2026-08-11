export type SupportProgressInput = Readonly<{
  status: string;
  executionAttempts: number;
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
  const executionAttempts = Math.max(0, input.executionAttempts);
  const nextAttempt = Math.min(3, executionAttempts + 1);
  const activeAttempt = Math.min(3, Math.max(1, executionAttempts));
  if (input.status === "TRIAGED" || input.status === "APPROVED") return {
    attempt: nextAttempt,
    headline: executionAttempts > 0 ? "Nova tentativa programada" : deliveredAttempt > 0 ? "Reabertura aceita" : "Solicitação aceita",
    description: executionAttempts > 0
      ? `A tentativa anterior não produziu uma solução implantável. A GUULY executará automaticamente a tentativa ${nextAttempt} de 3.`
      : `As informações foram recebidas. A GUULY executará automaticamente a tentativa ${nextAttempt} de 3, sem depender de nova aprovação.`,
    nextStep: "Próximo passo: a GUULY analisará as evidências, corrigirá, testará e implantará uma nova versão.",
    tone: "blue", stage: 2,
  };
  if (input.status === "IN_PROGRESS") return {
    attempt: activeAttempt,
    headline: `GUULY trabalhando · tentativa ${activeAttempt} de 3`,
    description: "A correção está sendo preparada, validada e encaminhada para implantação automática.",
    nextStep: "Próximo passo: após a implantação, você receberá a solicitação para testar a solução.",
    tone: "cyan", stage: 3,
  };
  if (input.status === "WAITING_USER_VALIDATION") return {
    attempt: activeAttempt,
    headline: `Sua validação é necessária · tentativa ${activeAttempt} de 3`,
    description: "A GUULY concluiu e implantou uma solução. Repita a operação que apresentou o problema.",
    nextStep: "Próximo passo: informe se o problema foi resolvido; se não, a GUULY coletará dados e tentará novamente.",
    tone: "amber", stage: 4,
  };
  if (input.status === "OWNER_ACTION_REQUIRED") return {
    attempt: activeAttempt,
    headline: "Ação do proprietário necessária",
    description: "A GUULY identificou uma dependência externa, administrativa ou de segurança que não pode ser alterada com segurança pelo código do G-SIPRO.",
    nextStep: "Próximo passo: o proprietário deve executar a orientação apresentada e confirmar a ação para que a GUULY valide e continue automaticamente.",
    tone: "amber", stage: 3,
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
    headline: "Aguardando aprovação do proprietário",
    description: "A solicitação é uma melhoria, nova ferramenta ou alteração funcional e precisa de decisão antes da execução.",
    nextStep: "Próximo passo: o proprietário aprovará ou rejeitará a solicitação na tela Aprovações do G-SIPRO.",
    tone: "amber", stage: 2,
  };
  if (input.status === "REJECTED" || input.status === "CANCELLED") return {
    attempt: Math.max(1, deliveredAttempt), headline: "Chamado encerrado", description: "O atendimento não está mais ativo.", nextStep: "Abra um novo chamado se precisar retomar o assunto.", tone: "slate", stage: 4,
  };
  return {
    attempt: nextAttempt, headline: "Solicitação recebida", description: "O chamado foi registrado e está sendo analisado pela GUULY.", nextStep: "Próximo passo: diagnóstico e entrada automática na fila técnica.", tone: "blue", stage: 1,
  };
}
