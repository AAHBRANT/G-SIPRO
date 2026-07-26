import type { OpportunityOrigin, OpportunityStatus } from "@/modules/opportunities/domain/opportunity";

export const statusLabels: Record<OpportunityStatus, string> = {
  DRAFT: "Rascunho",
  QUALIFICATION: "Em análise",
  ACTIVE: "Validada / em proposta",
  SUSPENDED: "Suspensa",
  CLOSED: "Encerrada",
};

export const originLabels: Record<OpportunityOrigin, string> = {
  PORTAL: "Portal",
  CHANNEL: "Canal",
  REFERRAL: "Indicação",
  CUSTOMER: "Cliente",
  PROSPECTING: "Prospecção",
};
