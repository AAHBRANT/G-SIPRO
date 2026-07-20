CREATE TYPE "ProposalTechnicalCommentSeverity" AS ENUM ('NORMAL','CRITICAL');
CREATE TYPE "ProposalTechnicalCommentStatus" AS ENUM ('OPEN','RESOLVED');
CREATE TYPE "ProposalTechnicalReviewDecision" AS ENUM ('APPROVED','CHANGES_REQUIRED');

CREATE TABLE "proposal_technical_content_versions" (
  "id" UUID PRIMARY KEY,"sectionId" UUID NOT NULL,"version" INTEGER NOT NULL,"previousVersionId" UUID,"content" TEXT NOT NULL,"reason" VARCHAR(1000) NOT NULL,"contentHash" CHAR(64) NOT NULL,"createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdBy" UUID NOT NULL,"correlationId" UUID NOT NULL,
  CONSTRAINT "proposal_content_section_fkey" FOREIGN KEY("sectionId") REFERENCES "proposal_technical_sections"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_content_previous_fkey" FOREIGN KEY("previousVersionId") REFERENCES "proposal_technical_content_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_content_unique" UNIQUE("sectionId","version"),CONSTRAINT "proposal_content_version_positive" CHECK("version">0),CONSTRAINT "proposal_content_body" CHECK(length(btrim("content"))>=20),CONSTRAINT "proposal_content_reason" CHECK(length(btrim("reason"))>=10)
);
CREATE INDEX "proposal_content_previous_idx" ON "proposal_technical_content_versions"("previousVersionId");
CREATE INDEX "proposal_content_correlation_idx" ON "proposal_technical_content_versions"("correlationId");

CREATE TABLE "proposal_technical_evidence_links" (
  "id" UUID PRIMARY KEY,"sectionId" UUID NOT NULL,"technicalEvidenceId" UUID NOT NULL,"evidenceVersion" INTEGER NOT NULL,"evidenceType" "TechnicalEvidenceType" NOT NULL,"evidenceNumber" VARCHAR(100) NOT NULL,"documentVersionId" UUID NOT NULL,"documentFileHash" CHAR(64) NOT NULL,"locator" VARCHAR(500) NOT NULL,"justification" VARCHAR(1000) NOT NULL,"createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdBy" UUID NOT NULL,"correlationId" UUID NOT NULL,
  CONSTRAINT "proposal_evidence_section_fkey" FOREIGN KEY("sectionId") REFERENCES "proposal_technical_sections"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_evidence_record_fkey" FOREIGN KEY("technicalEvidenceId") REFERENCES "technical_evidence"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_evidence_document_fkey" FOREIGN KEY("documentVersionId") REFERENCES "managed_document_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_evidence_unique" UNIQUE("sectionId","technicalEvidenceId"),CONSTRAINT "proposal_evidence_locator" CHECK(length(btrim("locator"))>=3),CONSTRAINT "proposal_evidence_justification" CHECK(length(btrim("justification"))>=10)
);
CREATE INDEX "proposal_evidence_record_idx" ON "proposal_technical_evidence_links"("technicalEvidenceId");
CREATE INDEX "proposal_evidence_document_idx" ON "proposal_technical_evidence_links"("documentVersionId");
CREATE INDEX "proposal_evidence_correlation_idx" ON "proposal_technical_evidence_links"("correlationId");

CREATE TABLE "proposal_technical_review_comments" (
  "id" UUID PRIMARY KEY,"sectionId" UUID NOT NULL,"severity" "ProposalTechnicalCommentSeverity" NOT NULL,"comment" VARCHAR(2000) NOT NULL,"status" "ProposalTechnicalCommentStatus" NOT NULL DEFAULT 'OPEN',"createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,"createdBy" UUID NOT NULL,"resolvedAt" TIMESTAMPTZ(6),"resolvedBy" UUID,"resolution" VARCHAR(2000),"correlationId" UUID NOT NULL,
  CONSTRAINT "proposal_comment_section_fkey" FOREIGN KEY("sectionId") REFERENCES "proposal_technical_sections"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_comment_content" CHECK(length(btrim("comment"))>=10),
  CONSTRAINT "proposal_comment_resolution" CHECK(("status"='OPEN' AND "resolvedAt" IS NULL AND "resolvedBy" IS NULL AND "resolution" IS NULL) OR ("status"='RESOLVED' AND "resolvedAt" IS NOT NULL AND "resolvedBy" IS NOT NULL AND length(btrim("resolution"))>=10))
);
CREATE INDEX "proposal_comment_section_status_idx" ON "proposal_technical_review_comments"("sectionId","status","severity");
CREATE INDEX "proposal_comment_correlation_idx" ON "proposal_technical_review_comments"("correlationId");

CREATE TABLE "proposal_technical_reviews" (
  "id" UUID PRIMARY KEY,"sectionId" UUID NOT NULL,"version" INTEGER NOT NULL,"contentVersion" INTEGER NOT NULL,"decision" "ProposalTechnicalReviewDecision" NOT NULL,"justification" VARCHAR(2000) NOT NULL,"reviewedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,"reviewedBy" UUID NOT NULL,"correlationId" UUID NOT NULL,
  CONSTRAINT "proposal_review_section_fkey" FOREIGN KEY("sectionId") REFERENCES "proposal_technical_sections"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_review_reviewer_fkey" FOREIGN KEY("reviewedBy") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_review_unique" UNIQUE("sectionId","version"),CONSTRAINT "proposal_review_version_positive" CHECK("version">0),CONSTRAINT "proposal_review_content_version_positive" CHECK("contentVersion">0),CONSTRAINT "proposal_review_justification" CHECK(length(btrim("justification"))>=10)
);
CREATE INDEX "proposal_review_reviewer_idx" ON "proposal_technical_reviews"("reviewedBy","reviewedAt");
CREATE INDEX "proposal_review_correlation_idx" ON "proposal_technical_reviews"("correlationId");

CREATE FUNCTION "enforce_proposal_content_chain"() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE latest RECORD; BEGIN SELECT "id","version" INTO latest FROM "proposal_technical_content_versions" WHERE "sectionId"=NEW."sectionId" ORDER BY "version" DESC LIMIT 1; IF latest."id" IS NULL THEN IF NEW."version"<>1 OR NEW."previousVersionId" IS NOT NULL THEN RAISE EXCEPTION 'first content version must be version 1'; END IF; ELSIF NEW."version"<>latest."version"+1 OR NEW."previousVersionId"<>latest."id" THEN RAISE EXCEPTION 'content version must extend latest'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "proposal_content_chain_guard" BEFORE INSERT ON "proposal_technical_content_versions" FOR EACH ROW EXECUTE FUNCTION "enforce_proposal_content_chain"();
CREATE FUNCTION "reject_proposal_content_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'technical content versions are append-only'; END $$;
CREATE TRIGGER "proposal_content_append_only" BEFORE UPDATE OR DELETE ON "proposal_technical_content_versions" FOR EACH ROW EXECUTE FUNCTION "reject_proposal_content_mutation"();

CREATE FUNCTION "validate_proposal_evidence_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE evidence RECORD; BEGIN SELECT e."version",e."type",e."number",e."documentVersionId",d."fileHash",e."status" INTO evidence FROM "technical_evidence" e JOIN "managed_document_versions" d ON d."id"=e."documentVersionId" WHERE e."id"=NEW."technicalEvidenceId"; IF evidence."status" IS DISTINCT FROM 'CURRENT' THEN RAISE EXCEPTION 'technical evidence must be current'; END IF; IF NEW."evidenceVersion" IS DISTINCT FROM evidence."version" OR NEW."evidenceType" IS DISTINCT FROM evidence."type" OR NEW."evidenceNumber" IS DISTINCT FROM evidence."number" OR NEW."documentVersionId" IS DISTINCT FROM evidence."documentVersionId" OR NEW."documentFileHash" IS DISTINCT FROM evidence."fileHash" THEN RAISE EXCEPTION 'technical evidence snapshot does not match source'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "proposal_evidence_snapshot_guard" BEFORE INSERT ON "proposal_technical_evidence_links" FOR EACH ROW EXECUTE FUNCTION "validate_proposal_evidence_snapshot"();
CREATE FUNCTION "reject_proposal_evidence_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'technical evidence links are append-only'; END $$;
CREATE TRIGGER "proposal_evidence_append_only" BEFORE UPDATE OR DELETE ON "proposal_technical_evidence_links" FOR EACH ROW EXECUTE FUNCTION "reject_proposal_evidence_mutation"();

CREATE FUNCTION "guard_proposal_comment_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' OR OLD."sectionId"<>NEW."sectionId" OR OLD."severity"<>NEW."severity" OR OLD."comment"<>NEW."comment" OR OLD."createdAt"<>NEW."createdAt" OR OLD."createdBy"<>NEW."createdBy" OR OLD."correlationId"<>NEW."correlationId" OR OLD."status"<>'OPEN' OR NEW."status"<>'RESOLVED' THEN RAISE EXCEPTION 'review comment mutation not allowed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "proposal_comment_guard" BEFORE UPDATE OR DELETE ON "proposal_technical_review_comments" FOR EACH ROW EXECUTE FUNCTION "guard_proposal_comment_mutation"();

CREATE FUNCTION "validate_proposal_review"() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE latest_content INTEGER; reviewer_status "UserStatus"; BEGIN SELECT "status" INTO reviewer_status FROM "users" WHERE "id"=NEW."reviewedBy"; IF reviewer_status IS DISTINCT FROM 'ACTIVE' THEN RAISE EXCEPTION 'reviewer must be active'; END IF; SELECT max("version") INTO latest_content FROM "proposal_technical_content_versions" WHERE "sectionId"=NEW."sectionId"; IF latest_content IS NULL OR NEW."contentVersion"<>latest_content THEN RAISE EXCEPTION 'review must reference latest content'; END IF; IF NEW."decision"='APPROVED' AND (NOT EXISTS(SELECT 1 FROM "proposal_technical_evidence_links" WHERE "sectionId"=NEW."sectionId") OR EXISTS(SELECT 1 FROM "proposal_technical_review_comments" WHERE "sectionId"=NEW."sectionId" AND "status"='OPEN')) THEN RAISE EXCEPTION 'approval requires evidence and no open comments'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "proposal_review_guard" BEFORE INSERT ON "proposal_technical_reviews" FOR EACH ROW EXECUTE FUNCTION "validate_proposal_review"();
CREATE FUNCTION "reject_proposal_review_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'technical reviews are append-only'; END $$;
CREATE TRIGGER "proposal_review_append_only" BEFORE UPDATE OR DELETE ON "proposal_technical_reviews" FOR EACH ROW EXECUTE FUNCTION "reject_proposal_review_mutation"();

CREATE FUNCTION "invalidate_proposal_section_review"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE next_version INTEGER;
BEGIN
  UPDATE "proposal_technical_sections" SET "status"='IN_PROGRESS',"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP,"updatedBy"=NEW."createdBy" WHERE "id"=NEW."sectionId" AND "status"='COMPLETED' RETURNING "version" INTO next_version;
  IF next_version IS NOT NULL THEN
    INSERT INTO "proposal_technical_section_history"("id","sectionId","version","action","snapshot","changedById","correlationId") VALUES(gen_random_uuid(),NEW."sectionId",next_version,'TECHNICAL_REVIEW_INVALIDATED',jsonb_build_object('source',TG_TABLE_NAME,'status','IN_PROGRESS'),NEW."createdBy",NEW."correlationId");
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "proposal_content_invalidate_review" AFTER INSERT ON "proposal_technical_content_versions" FOR EACH ROW EXECUTE FUNCTION "invalidate_proposal_section_review"();
CREATE TRIGGER "proposal_evidence_invalidate_review" AFTER INSERT ON "proposal_technical_evidence_links" FOR EACH ROW EXECUTE FUNCTION "invalidate_proposal_section_review"();
CREATE TRIGGER "proposal_comment_invalidate_review" AFTER INSERT ON "proposal_technical_review_comments" FOR EACH ROW EXECUTE FUNCTION "invalidate_proposal_section_review"();

CREATE OR REPLACE FUNCTION "validate_proposal_technical_section"() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE component_type "ProposalComponentType"; responsible_status "UserStatus"; BEGIN SELECT "type" INTO component_type FROM "proposal_components" WHERE "id"=NEW."componentId"; IF component_type IS DISTINCT FROM 'TECHNICAL' THEN RAISE EXCEPTION 'technical section requires technical component'; END IF; SELECT "status" INTO responsible_status FROM "users" WHERE "id"=NEW."responsibleId"; IF responsible_status IS DISTINCT FROM 'ACTIVE' THEN RAISE EXCEPTION 'technical section responsible must be active'; END IF; IF NEW."status"='COMPLETED' AND NOT EXISTS(SELECT 1 FROM "proposal_technical_reviews" WHERE "sectionId"=NEW."id" AND "decision"='APPROVED') THEN RAISE EXCEPTION 'completed section requires approved technical review'; END IF; IF NEW."status"='COMPLETED' AND EXISTS(SELECT 1 FROM "proposal_technical_review_comments" WHERE "sectionId"=NEW."id" AND "severity"='CRITICAL' AND "status"='OPEN') THEN RAISE EXCEPTION 'critical review comment blocks completion'; END IF; RETURN NEW; END $$;
