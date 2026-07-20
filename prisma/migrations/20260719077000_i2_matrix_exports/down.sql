DROP TRIGGER IF EXISTS "compliance_matrix_export_append_only" ON "compliance_matrix_exports";
DROP FUNCTION IF EXISTS "reject_compliance_matrix_export_mutation"();
DROP TRIGGER IF EXISTS "compliance_matrix_update_guard" ON "compliance_matrices";
DROP FUNCTION IF EXISTS "guard_compliance_matrix_update"();
DROP TRIGGER IF EXISTS "compliance_matrix_export_guard" ON "compliance_matrix_exports";
DROP FUNCTION IF EXISTS "enforce_compliance_matrix_export"();
DROP TABLE IF EXISTS "compliance_matrix_exports";

