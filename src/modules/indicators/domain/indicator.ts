import { z } from "zod";
const text=(max:number)=>z.string().trim().min(1).max(max);
export const indicatorSourceSchema=z.object({logicalTable:text(160),field:text(160),validStatuses:z.array(text(80)).min(1).max(30)});
export const indicatorDefinitionSchema=z.object({
  previousDefinitionId:z.uuid().optional(),code:text(80).transform(value=>value.toUpperCase()),name:text(200),purpose:text(1000),ownerId:z.uuid(),
  calculationMethod:z.enum(["PIPELINE_COUNT","PIPELINE_VALUE","RESULT_CONVERSION_RATE","FINANCIAL_CONVERSION_RATE","AVERAGE_DISCOUNT_PERCENT","AVERAGE_MARGIN_PERCENT"]),
  numeratorDefinition:text(10_000),denominatorDefinition:text(10_000),treatmentDefinition:text(10_000),granularity:text(500),
  sourceMappings:z.array(indicatorSourceSchema).min(1).max(50),dimensions:z.array(text(160)).min(1).max(50),
  refreshPeriodicity:text(200),refreshTime:text(80),accessRule:text(1000),rowSecurityRule:text(1000),
  qualityTest:text(1000),qualityTolerance:text(500),qualityOwnerId:z.uuid(),effectiveFrom:z.iso.date(),changeReason:text(1000),
});
export const indicatorApprovalSchema=z.object({note:z.string().trim().min(3).max(1000)});
export const indicatorCalculationSchema=z.object({periodStart:z.iso.date(),periodEnd:z.iso.date(),currency:z.string().trim().length(3).transform(value=>value.toUpperCase()).optional()}).refine(value=>value.periodEnd>=value.periodStart,{message:"O fim do período deve ser igual ou posterior ao início.",path:["periodEnd"]});
export const indicatorReconciliationSchema=z.object({note:z.string().trim().min(3).max(1000)});
export const indicatorPublicationSchema=z.object({note:z.string().trim().min(3).max(1000)});
export type IndicatorDefinitionDraft=z.infer<typeof indicatorDefinitionSchema>;export type IndicatorApprovalDraft=z.infer<typeof indicatorApprovalSchema>;export type IndicatorCalculationDraft=z.infer<typeof indicatorCalculationSchema>;export type IndicatorReconciliationDraft=z.infer<typeof indicatorReconciliationSchema>;export type IndicatorPublicationDraft=z.infer<typeof indicatorPublicationSchema>;
