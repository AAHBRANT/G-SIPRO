import type { OpportunityDraft } from "@/modules/opportunities/domain/opportunity";

export type DuplicateCandidateSource = Readonly<{
  id: string;
  code: string;
  subject?: string;
  customerId?: string;
  contractingAuthorityId?: string;
}>;

export type DuplicateCandidate = Readonly<{
  id: string;
  code: string;
  score: number;
  reasons: readonly string[];
}>;

function tokens(value?: string): ReadonlySet<string> {
  if (!value) return new Set();
  return new Set(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

export function subjectSimilarity(left?: string, right?: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

export function detectDuplicateCandidates(
  draft: OpportunityDraft,
  sources: readonly DuplicateCandidateSource[],
): readonly DuplicateCandidate[] {
  return sources
    .map((source) => {
      const similarity = subjectSimilarity(draft.subject, source.subject);
      const sameCustomer = Boolean(draft.customerId && draft.customerId === source.customerId);
      const sameAuthority = Boolean(
        draft.contractingAuthorityId && draft.contractingAuthorityId === source.contractingAuthorityId,
      );
      const reasons = [
        similarity >= 0.7 && `Objeto semelhante (${Math.round(similarity * 100)}%)`,
        sameCustomer && "Mesmo cliente",
        sameAuthority && "Mesmo órgão contratante",
      ].filter((reason): reason is string => Boolean(reason));
      const score = Math.min(1, similarity * 0.75 + (sameCustomer || sameAuthority ? 0.25 : 0));
      return { id: source.id, code: source.code, score, reasons };
    })
    .filter((candidate) => candidate.reasons.length > 0 && candidate.score >= 0.7)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}
