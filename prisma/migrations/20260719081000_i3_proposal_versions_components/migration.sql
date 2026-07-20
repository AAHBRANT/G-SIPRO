CREATE TYPE "ProposalComponentType" AS ENUM ('TECHNICAL','COMMERCIAL');
CREATE TYPE "ProposalComponentStatus" AS ENUM ('DRAFT','IN_REVIEW','APPROVED');

CREATE TABLE "proposal_versions" (
  "id" UUID PRIMARY KEY,
  "proposalId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "previousVersionId" UUID,
  "reason" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  CONSTRAINT "proposal_version_proposal_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_version_previous_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "proposal_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_version_positive" CHECK ("version" > 0),
  CONSTRAINT "proposal_version_reason" CHECK (length(btrim("reason")) >= 10),
  CONSTRAINT "proposal_version_unique" UNIQUE ("proposalId","version")
);
CREATE INDEX "proposal_version_previous_idx" ON "proposal_versions"("previousVersionId");
CREATE INDEX "proposal_version_correlation_idx" ON "proposal_versions"("correlationId");

CREATE TABLE "proposal_components" (
  "id" UUID PRIMARY KEY,
  "proposalVersionId" UUID NOT NULL,
  "type" "ProposalComponentType" NOT NULL,
  "status" "ProposalComponentStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  CONSTRAINT "proposal_component_version_fkey" FOREIGN KEY ("proposalVersionId") REFERENCES "proposal_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_component_unique" UNIQUE ("proposalVersionId","type")
);
CREATE INDEX "proposal_component_type_status_idx" ON "proposal_components"("type","status");

INSERT INTO "proposal_versions"("id","proposalId","version","reason","createdAt","createdBy","correlationId")
SELECT gen_random_uuid(),"id",1,'Versão inicial migrada do cadastro BL-301.',"createdAt","createdBy",gen_random_uuid() FROM "proposals";
INSERT INTO "proposal_components"("id","proposalVersionId","type","status","createdAt","createdBy")
SELECT gen_random_uuid(),version."id",kind."type"::"ProposalComponentType",'DRAFT',version."createdAt",version."createdBy" FROM "proposal_versions" version CROSS JOIN (VALUES ('TECHNICAL'),('COMMERCIAL')) kind("type");

CREATE FUNCTION "enforce_proposal_version_chain"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest RECORD;
BEGIN
  SELECT "id","version" INTO latest FROM "proposal_versions" WHERE "proposalId"=NEW."proposalId" ORDER BY "version" DESC LIMIT 1;
  IF latest."id" IS NULL THEN
    IF NEW."version" <> 1 OR NEW."previousVersionId" IS NOT NULL THEN RAISE EXCEPTION 'first proposal version must be version 1'; END IF;
  ELSIF NEW."version" <> latest."version" + 1 OR NEW."previousVersionId" <> latest."id" THEN RAISE EXCEPTION 'proposal version must extend the latest version'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "proposal_version_chain_guard" BEFORE INSERT ON "proposal_versions" FOR EACH ROW EXECUTE FUNCTION "enforce_proposal_version_chain"();

CREATE FUNCTION "reject_proposal_version_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'proposal versions are append-only'; END $$;
CREATE TRIGGER "proposal_version_append_only" BEFORE UPDATE OR DELETE ON "proposal_versions" FOR EACH ROW EXECUTE FUNCTION "reject_proposal_version_mutation"();

