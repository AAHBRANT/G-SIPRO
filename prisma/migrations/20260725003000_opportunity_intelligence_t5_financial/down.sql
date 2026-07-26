DELETE FROM profile_permissions
WHERE "permissionId" IN(
  'e5900000-0000-4000-8000-000000000010',
  'e5900000-0000-4000-8000-000000000011'
);
DELETE FROM permissions
WHERE id IN(
  'e5900000-0000-4000-8000-000000000010',
  'e5900000-0000-4000-8000-000000000011'
);

DROP TRIGGER IF EXISTS trg_opportunity_financial_studies_append_only ON opportunity_financial_studies;
DROP TABLE IF EXISTS opportunity_financial_studies;
DROP TRIGGER IF EXISTS trg_customer_payment_assessments_append_only ON customer_payment_assessments;
DROP TABLE IF EXISTS customer_payment_assessments;
DROP TRIGGER IF EXISTS trg_financial_capacity_assessments_append_only ON financial_capacity_assessments;
DROP TABLE IF EXISTS financial_capacity_assessments;
DROP TYPE IF EXISTS "PaymentRiskClassification";
DROP TYPE IF EXISTS "FinancialAssessmentConclusion";
