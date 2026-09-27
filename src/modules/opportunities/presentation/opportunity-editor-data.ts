import type { Prisma } from "@/generated/prisma/client";
import type { OpportunityEditorData } from "@/app/opportunities/[id]/opportunity-editor";

export type OpportunityEditorRecord = Prisma.OpportunityGetPayload<{
  include: { customer: true; contractingAuthority: true };
}>;

function localDateTime(value: Date | null): string | undefined {
  if (!value) return undefined;
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * Extraído de `opportunities/[id]/page.tsx` (25/09/2026): a mesma conversão
 * de registro do Prisma para o formato que `OpportunityEditor` consome,
 * chamável também pela rota de detalhe sob pedido que a janelinha do mapa da
 * Análise usa. As duas têm de concordar sobre o formato — daí a função única.
 */
export function buildOpportunityEditorData(record: OpportunityEditorRecord): OpportunityEditorData {
  return {
    id: record.id,
    code: record.code,
    origin: record.origin,
    status: record.status,
    ...(record.subject && { subject: record.subject }),
    ...(record.estimatedValue !== null && { estimatedValue: record.estimatedValue.toString() }),
    ...(record.currency && { currency: record.currency }),
    ...(record.valueSource && { valueSource: record.valueSource }),
    ...(record.contractingAuthority && {
      contractingAuthorityId: record.contractingAuthority.id,
      contractingAuthorityName: record.contractingAuthority.name,
    }),
    ...(record.customer && { customerId: record.customer.id, customerName: record.customer.name }),
    ...(localDateTime(record.publishedAt) && { publishedAt: localDateTime(record.publishedAt) }),
    ...(localDateTime(record.deliveryAt) && { deliveryAt: localDateTime(record.deliveryAt) }),
    ...(record.datesSource && { datesSource: record.datesSource }),
    ...(record.datesTimeZone && { datesTimeZone: record.datesTimeZone }),
    ...(record.ownerId && { ownerId: record.ownerId }),
  };
}
