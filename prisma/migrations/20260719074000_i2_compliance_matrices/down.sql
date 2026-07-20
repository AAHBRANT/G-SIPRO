DROP TRIGGER IF EXISTS "compliance_matrix_history_append_only" ON "compliance_matrix_history";
DROP TRIGGER IF EXISTS "compliance_matrix_items_append_only" ON "compliance_matrix_items";
DROP TRIGGER IF EXISTS "compliance_matrix_item_origin_guard" ON "compliance_matrix_items";
DROP FUNCTION IF EXISTS "reject_compliance_matrix_snapshot_mutation"();
DROP FUNCTION IF EXISTS "enforce_compliance_matrix_item_origin"();
DROP TABLE IF EXISTS "compliance_matrix_history";
DROP TABLE IF EXISTS "compliance_matrix_items";
DROP TABLE IF EXISTS "compliance_matrices";
DROP TYPE IF EXISTS "ComplianceMatrixStatus";

