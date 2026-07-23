import { z } from "zod";

export const supportAssistantCommandSchema = z.object({
  message: z.string().trim().min(3).max(2_000),
});

export type SupportAssistantDisposition = {
  nextStatus?: "TRIAGED";
  resetExecution?: boolean;
  response: string;
};

export function supportAssistantDisposition(status: string, isOwner: boolean): SupportAssistantDisposition {
  switch (status) {
    case "OPEN":
      return {
        nextStatus: "TRIAGED",
        response: "Entendi. Registrei sua orientação e coloquei o chamado na fila automática da IA. A execução costuma iniciar em até 5 minutos.",
      };
    case "TRIAGED":
    case "APPROVED":
      return {
        response: "Entendi. Sua orientação foi anexada ao chamado, que já está na fila automática da IA. A execução costuma iniciar em até 5 minutos.",
      };
    case "IN_PROGRESS":
      return {
        response: "Entendi. Sua orientação foi registrada no histórico técnico. A execução atual continuará e o resultado aparecerá aqui para validação.",
      };
    case "WAITING_APPROVAL":
      return {
        response: "Registrei sua mensagem, mas esta alteração ainda depende da aprovação do proprietário. A IA começará automaticamente após a aprovação.",
      };
    case "OWNER_ACTION_REQUIRED":
      return {
        response: "Este chamado depende de uma ação protegida fora do G-SIPRO. Execute a orientação exibida acima e use “Confirmar ação e devolver à IA”; depois disso, a automação continuará.",
      };
    case "WAITING_USER_VALIDATION":
      return {
        response: "A IA já entregou uma solução para este ciclo. Valide o resultado acima. Se o problema continuar, informe o motivo para iniciar uma nova tentativa.",
      };
    case "ESCALATED":
      return isOwner
        ? {
            nextStatus: "TRIAGED",
            resetExecution: true,
            response: "Nova orientação aceita pelo proprietário. Zerei o ciclo técnico e devolvi o chamado à fila automática da IA para uma nova execução.",
          }
        : {
            response: "Após três tentativas, este chamado depende do proprietário. Sua mensagem foi registrada e ficará disponível para a decisão dele.",
          };
    case "RESOLVED":
      return {
        response: "Este chamado está concluído. Se o problema voltou, use a opção de reabrir para preservar o histórico e iniciar um novo ciclo.",
      };
    case "REJECTED":
    case "CANCELLED":
      return {
        response: "Este chamado está encerrado sem execução. Para voltar a tratá-lo, o proprietário precisa reabri-lo.",
      };
    default:
      return {
        response: "Sua orientação foi registrada no histórico do chamado. A próxima ação será atualizada neste painel.",
      };
  }
}
