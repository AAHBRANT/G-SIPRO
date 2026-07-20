DROP TRIGGER IF EXISTS "proposal_version_append_only" ON "proposal_versions";
DROP FUNCTION IF EXISTS "reject_proposal_version_mutation"();
DROP TRIGGER IF EXISTS "proposal_version_chain_guard" ON "proposal_versions";
DROP FUNCTION IF EXISTS "enforce_proposal_version_chain"();
DROP TABLE IF EXISTS "proposal_components";
DROP TABLE IF EXISTS "proposal_versions";
DROP TYPE IF EXISTS "ProposalComponentStatus";
DROP TYPE IF EXISTS "ProposalComponentType";

