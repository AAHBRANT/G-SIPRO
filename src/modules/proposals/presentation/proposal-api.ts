import { Prisma } from "@/generated/prisma/client";
import { ConflictError, ResourceNotFoundError, ValidationError } from "@/core/errors/application-error";
import { ProposalNotFoundError, ProposalOpportunityNotFoundError, ProposalOriginRuleError, ProposalTenderNotFoundError } from "@/modules/proposals/infrastructure/prisma-proposal-repository";

export function mapProposalApiError(error: unknown): never {
  if (error instanceof ProposalNotFoundError || error instanceof ProposalOpportunityNotFoundError || error instanceof ProposalTenderNotFoundError) throw new ResourceNotFoundError(error.message);
  if (error instanceof ProposalOriginRuleError) throw new ValidationError(error.message);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("Já existe uma proposta com o código informado.", { fields: ["code"] });
  throw error;
}
