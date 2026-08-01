import { parseProposalAnalysisFields } from "@/app/proposals/proposal-analysis-summary";
import { inferPublicAuthorityFromValueSource } from "@/modules/opportunities/domain/public-authority-inference";

export type AuthorityHint = Readonly<{
  raw: string;
  suggestedName: string;
}>;

const authorityFieldPattern = /órgão|orgao|contratante|cliente/i;

// Os documentos analisados pela IA às vezes já trazem o nome do órgão contratante
// como um campo extraído (ex.: "Órgão Contratante" -> "Prefeitura de Gravataí"),
// mas nada usava essa informação para vincular o campo estruturado da
// oportunidade — o usuário tinha que digitar de novo manualmente.
export function inferAuthorityHintFromDocuments(
  documents: readonly { analysis: null | { output: unknown } }[],
): AuthorityHint | undefined {
  for (const document of documents) {
    for (const field of parseProposalAnalysisFields(document.analysis?.output)) {
      if (!authorityFieldPattern.test(field.field)) continue;
      const inferred = inferPublicAuthorityFromValueSource(field.value);
      if (inferred) return { raw: field.value, suggestedName: inferred.name };
    }
  }
  return undefined;
}
