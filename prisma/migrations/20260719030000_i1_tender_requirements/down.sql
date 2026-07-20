DROP TRIGGER IF EXISTS requirement_history_append_only ON "requirement_history";
DROP FUNCTION IF EXISTS prevent_requirement_history_mutation();
DROP TABLE IF EXISTS "requirement_history";
DROP TABLE IF EXISTS "tender_requirements";
DROP TYPE IF EXISTS "RequirementStatus";
DROP TYPE IF EXISTS "RequirementCriticality";
