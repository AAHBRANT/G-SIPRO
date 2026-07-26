import { z } from "zod";

// NOTE: nenhuma rota ativa cria propostas por este caminho hoje (não existe
// src/app/api/proposals/route.ts); a única criação real de proposta é
// automática, em OpportunityRepository.revise(), que herda o código da
// oportunidade de origem em vez de aceitar um `code` informado.
export const proposalDraftSchema = z.object({
  code: z.string().trim().min(1).max(50).transform(value => value.toUpperCase()),
  title: z.string().trim().min(3).max(255).optional(),
  opportunityId: z.uuid(),
  originType: z.enum(["PUBLIC_TENDER", "PRIVATE_COMPETITION", "DIRECT"]).optional(),
  tenderVersionId: z.uuid().optional(),
  tenderLotId: z.uuid().optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.tenderVersionId) !== Boolean(value.tenderLotId)) context.addIssue({ code: "custom", path: ["tenderVersionId"], message: "Versão do edital e lote devem ser informados juntos." });
});

export type ProposalDraft = z.infer<typeof proposalDraftSchema>;

export const proposalVersionSchema = z.object({ reason: z.string().trim().min(10).max(1000) }).strict();
export type ProposalVersionDraft = z.infer<typeof proposalVersionSchema>;
