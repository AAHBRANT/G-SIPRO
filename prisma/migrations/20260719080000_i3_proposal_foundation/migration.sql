CREATE TYPE "ProposalStatus" AS ENUM ('PREPARATION','REVIEW','APPROVAL','SENT','JUDGED','CLOSED');

CREATE TABLE "proposals" (
  "id" UUID PRIMARY KEY,
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "opportunityId" UUID NOT NULL,
  "opportunityVersion" INTEGER NOT NULL,
  "tenderVersionId" UUID,
  "tenderVersionNumber" INTEGER,
  "tenderFileHash" CHAR(64),
  "tenderLotId" UUID,
  "tenderLotCode" VARCHAR(80),
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "ProposalStatus" NOT NULL DEFAULT 'PREPARATION',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "updatedBy" UUID NOT NULL,
  CONSTRAINT "proposal_opportunity_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_tender_version_fkey" FOREIGN KEY ("tenderVersionId") REFERENCES "tender_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_tender_lot_fkey" FOREIGN KEY ("tenderLotId") REFERENCES "tender_lots"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_versions_positive" CHECK ("version" > 0 AND "opportunityVersion" > 0),
  CONSTRAINT "proposal_tender_bundle" CHECK (("tenderVersionId" IS NULL AND "tenderVersionNumber" IS NULL AND "tenderFileHash" IS NULL AND "tenderLotId" IS NULL AND "tenderLotCode" IS NULL) OR ("tenderVersionId" IS NOT NULL AND "tenderVersionNumber" IS NOT NULL AND "tenderFileHash" IS NOT NULL AND "tenderLotId" IS NOT NULL AND "tenderLotCode" IS NOT NULL)),
  CONSTRAINT "proposal_tender_hash" CHECK ("tenderFileHash" IS NULL OR "tenderFileHash" ~ '^[0-9A-Fa-f]{64}$')
);
CREATE INDEX "proposal_opportunity_status_idx" ON "proposals"("opportunityId","status");
CREATE INDEX "proposal_tender_version_idx" ON "proposals"("tenderVersionId");
CREATE INDEX "proposal_tender_lot_idx" ON "proposals"("tenderLotId");

CREATE TABLE "proposal_history" (
  "id" UUID PRIMARY KEY,
  "proposalId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedById" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  CONSTRAINT "proposal_history_proposal_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_history_user_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_history_version_positive" CHECK ("version" > 0),
  CONSTRAINT "proposal_history_proposal_version_key" UNIQUE ("proposalId","version")
);
CREATE INDEX "proposal_history_user_date_idx" ON "proposal_history"("changedById","changedAt");
CREATE INDEX "proposal_history_correlation_idx" ON "proposal_history"("correlationId");

CREATE FUNCTION "enforce_proposal_origin"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE opportunity_record RECORD; tender_count INTEGER; tender_record RECORD; lot_record RECORD;
BEGIN
  SELECT "version" INTO opportunity_record FROM "opportunities" WHERE "id"=NEW."opportunityId";
  IF opportunity_record."version" IS NULL THEN RAISE EXCEPTION 'proposal opportunity not found'; END IF;
  IF opportunity_record."version" <> NEW."opportunityVersion" THEN RAISE EXCEPTION 'proposal must snapshot the current opportunity version'; END IF;
  SELECT count(*)::integer INTO tender_count FROM "tenders" WHERE "opportunityId"=NEW."opportunityId";
  IF tender_count > 0 AND (NEW."tenderVersionId" IS NULL OR NEW."tenderLotId" IS NULL) THEN RAISE EXCEPTION 'proposal requires tender version and lot when opportunity has tender'; END IF;
  IF tender_count = 0 AND (NEW."tenderVersionId" IS NOT NULL OR NEW."tenderLotId" IS NOT NULL) THEN RAISE EXCEPTION 'proposal cannot reference tender outside its opportunity'; END IF;
  IF NEW."tenderVersionId" IS NOT NULL THEN
    SELECT version."version",version."fileHash",tender."id" AS "tenderId",tender."opportunityId" INTO tender_record FROM "tender_versions" version JOIN "tenders" tender ON tender."id"=version."tenderId" WHERE version."id"=NEW."tenderVersionId";
    SELECT "tenderId","code" INTO lot_record FROM "tender_lots" WHERE "id"=NEW."tenderLotId";
    IF tender_record."opportunityId" <> NEW."opportunityId" OR lot_record."tenderId" <> tender_record."tenderId" THEN RAISE EXCEPTION 'proposal tender version and lot must belong to its opportunity and same tender'; END IF;
    IF tender_record."version" <> NEW."tenderVersionNumber" OR tender_record."fileHash" <> NEW."tenderFileHash" OR lot_record."code" <> NEW."tenderLotCode" THEN RAISE EXCEPTION 'proposal must preserve tender version, hash and lot code'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "proposal_origin_guard" BEFORE INSERT ON "proposals" FOR EACH ROW EXECUTE FUNCTION "enforce_proposal_origin"();

CREATE FUNCTION "reject_proposal_history_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'proposal history is append-only'; END $$;
CREATE TRIGGER "proposal_history_append_only" BEFORE UPDATE OR DELETE ON "proposal_history" FOR EACH ROW EXECUTE FUNCTION "reject_proposal_history_mutation"();

