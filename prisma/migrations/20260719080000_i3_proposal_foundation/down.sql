DROP TRIGGER IF EXISTS "proposal_history_append_only" ON "proposal_history";
DROP FUNCTION IF EXISTS "reject_proposal_history_mutation"();
DROP TRIGGER IF EXISTS "proposal_origin_guard" ON "proposals";
DROP FUNCTION IF EXISTS "enforce_proposal_origin"();
DROP TABLE IF EXISTS "proposal_history";
DROP TABLE IF EXISTS "proposals";
DROP TYPE IF EXISTS "ProposalStatus";

