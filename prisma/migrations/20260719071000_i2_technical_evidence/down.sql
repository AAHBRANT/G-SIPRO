DROP TRIGGER IF EXISTS "technical_evidence_append_only" ON "technical_evidence";
DROP TRIGGER IF EXISTS "technical_evidence_integrity" ON "technical_evidence";
DROP FUNCTION IF EXISTS prevent_technical_evidence_mutation();
DROP FUNCTION IF EXISTS enforce_technical_evidence_integrity();
DROP TABLE IF EXISTS "technical_evidence";
DROP TYPE IF EXISTS "TechnicalEvidenceStatus";
DROP TYPE IF EXISTS "TechnicalEvidenceType";
