DROP TRIGGER IF EXISTS "compliance_item_assessment_append_only" ON "compliance_item_assessments";
DROP FUNCTION IF EXISTS "reject_compliance_item_assessment_mutation"();
DROP TRIGGER IF EXISTS "compliance_item_assessment_guard" ON "compliance_item_assessments";
DROP FUNCTION IF EXISTS "enforce_compliance_item_assessment"();
DROP TABLE IF EXISTS "compliance_item_assessments";
DROP TYPE IF EXISTS "ComplianceItemDecision";

