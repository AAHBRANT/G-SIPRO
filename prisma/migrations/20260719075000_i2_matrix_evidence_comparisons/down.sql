DROP TRIGGER IF EXISTS "quantity_comparison_append_only" ON "compliance_quantity_comparisons";
DROP TRIGGER IF EXISTS "matrix_evidence_append_only" ON "compliance_matrix_evidence";
DROP TRIGGER IF EXISTS "quantity_comparison_origin_guard" ON "compliance_quantity_comparisons";
DROP TRIGGER IF EXISTS "matrix_evidence_origin_guard" ON "compliance_matrix_evidence";
DROP FUNCTION IF EXISTS "reject_matrix_evidence_mutation"();
DROP FUNCTION IF EXISTS "enforce_quantity_comparison_origin"();
DROP FUNCTION IF EXISTS "enforce_matrix_evidence_origin"();
DROP TABLE IF EXISTS "compliance_quantity_comparisons";
DROP TABLE IF EXISTS "compliance_matrix_evidence";

