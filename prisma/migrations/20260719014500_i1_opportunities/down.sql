-- Reversão controlada da migração I1 / BL-101.
DROP TRIGGER IF EXISTS opportunity_history_append_only ON "opportunity_history";
DROP FUNCTION IF EXISTS prevent_opportunity_history_mutation();
DROP TABLE IF EXISTS "opportunity_history";
DROP TABLE IF EXISTS "opportunities";
DROP TABLE IF EXISTS "contracting_authorities";
DROP TABLE IF EXISTS "customers";
DROP TYPE IF EXISTS "OpportunityStatus";
DROP TYPE IF EXISTS "OpportunityOrigin";
