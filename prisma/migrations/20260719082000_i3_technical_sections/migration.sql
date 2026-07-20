CREATE TYPE "ProposalTechnicalSectionStatus" AS ENUM ('DRAFT','IN_PROGRESS','IN_REVIEW','COMPLETED');

CREATE TABLE "proposal_technical_sections" (
  "id" UUID PRIMARY KEY,
  "componentId" UUID NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "position" INTEGER NOT NULL,
  "responsibleId" UUID NOT NULL,
  "status" "ProposalTechnicalSectionStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" UUID NOT NULL,
  CONSTRAINT "proposal_technical_section_component_fkey" FOREIGN KEY ("componentId") REFERENCES "proposal_components"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_technical_section_responsible_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_technical_section_position_positive" CHECK ("position" > 0),
  CONSTRAINT "proposal_technical_section_version_positive" CHECK ("version" > 0),
  CONSTRAINT "proposal_technical_section_type_content" CHECK (length(btrim("type")) >= 2),
  CONSTRAINT "proposal_technical_section_title_content" CHECK (length(btrim("title")) >= 3),
  CONSTRAINT "proposal_technical_section_component_position_unique" UNIQUE ("componentId","position")
);
CREATE INDEX "proposal_technical_section_responsible_status_idx" ON "proposal_technical_sections"("responsibleId","status");
CREATE INDEX "proposal_technical_section_component_status_idx" ON "proposal_technical_sections"("componentId","status");

CREATE TABLE "proposal_technical_section_requirements" (
  "sectionId" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "requirementVersion" INTEGER NOT NULL,
  "requirementType" VARCHAR(80) NOT NULL,
  "requirementText" TEXT NOT NULL,
  "sourceExcerpt" TEXT NOT NULL,
  "sourcePage" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID NOT NULL,
  PRIMARY KEY ("sectionId","requirementId"),
  CONSTRAINT "proposal_section_requirement_section_fkey" FOREIGN KEY ("sectionId") REFERENCES "proposal_technical_sections"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_section_requirement_requirement_fkey" FOREIGN KEY ("requirementId") REFERENCES "tender_requirements"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_section_requirement_version_positive" CHECK ("requirementVersion" > 0),
  CONSTRAINT "proposal_section_requirement_page_positive" CHECK ("sourcePage" > 0)
);
CREATE INDEX "proposal_section_requirement_requirement_idx" ON "proposal_technical_section_requirements"("requirementId");

CREATE TABLE "proposal_technical_section_history" (
  "id" UUID PRIMARY KEY,
  "sectionId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedById" UUID NOT NULL,
  "correlationId" UUID NOT NULL,
  CONSTRAINT "proposal_section_history_section_fkey" FOREIGN KEY ("sectionId") REFERENCES "proposal_technical_sections"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_section_history_changed_by_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "proposal_section_history_unique" UNIQUE ("sectionId","version")
);
CREATE INDEX "proposal_section_history_changed_at_idx" ON "proposal_technical_section_history"("changedById","changedAt");
CREATE INDEX "proposal_section_history_correlation_idx" ON "proposal_technical_section_history"("correlationId");

CREATE FUNCTION "validate_proposal_technical_section"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE component_type "ProposalComponentType"; responsible_status "UserStatus";
BEGIN
  SELECT "type" INTO component_type FROM "proposal_components" WHERE "id"=NEW."componentId";
  IF component_type IS DISTINCT FROM 'TECHNICAL' THEN RAISE EXCEPTION 'technical section requires technical component'; END IF;
  SELECT "status" INTO responsible_status FROM "users" WHERE "id"=NEW."responsibleId";
  IF responsible_status IS DISTINCT FROM 'ACTIVE' THEN RAISE EXCEPTION 'technical section responsible must be active'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "proposal_technical_section_guard" BEFORE INSERT OR UPDATE ON "proposal_technical_sections" FOR EACH ROW EXECUTE FUNCTION "validate_proposal_technical_section"();

CREATE FUNCTION "validate_proposal_section_requirement"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE requirement_row RECORD; proposal_tender_version UUID;
BEGIN
  SELECT "tenderVersionId","version","type","text","sourceExcerpt","sourcePage" INTO requirement_row FROM "tender_requirements" WHERE "id"=NEW."requirementId" AND "status"='VALIDATED';
  IF requirement_row."tenderVersionId" IS NULL THEN RAISE EXCEPTION 'proposal section requirement must be validated'; END IF;
  SELECT proposal."tenderVersionId" INTO proposal_tender_version FROM "proposal_technical_sections" section JOIN "proposal_components" component ON component."id"=section."componentId" JOIN "proposal_versions" version ON version."id"=component."proposalVersionId" JOIN "proposals" proposal ON proposal."id"=version."proposalId" WHERE section."id"=NEW."sectionId";
  IF proposal_tender_version IS DISTINCT FROM requirement_row."tenderVersionId" THEN RAISE EXCEPTION 'requirement must belong to proposal tender version'; END IF;
  IF NEW."requirementVersion" IS DISTINCT FROM requirement_row."version" OR NEW."requirementType" IS DISTINCT FROM requirement_row."type" OR NEW."requirementText" IS DISTINCT FROM requirement_row."text" OR NEW."sourceExcerpt" IS DISTINCT FROM requirement_row."sourceExcerpt" OR NEW."sourcePage" IS DISTINCT FROM requirement_row."sourcePage" THEN RAISE EXCEPTION 'requirement snapshot does not match source'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "proposal_section_requirement_guard" BEFORE INSERT ON "proposal_technical_section_requirements" FOR EACH ROW EXECUTE FUNCTION "validate_proposal_section_requirement"();

CREATE FUNCTION "reject_proposal_section_requirement_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'proposal section requirement snapshots are append-only'; END $$;
CREATE TRIGGER "proposal_section_requirement_append_only" BEFORE UPDATE OR DELETE ON "proposal_technical_section_requirements" FOR EACH ROW EXECUTE FUNCTION "reject_proposal_section_requirement_mutation"();

CREATE FUNCTION "reject_proposal_section_history_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'proposal section history is append-only'; END $$;
CREATE TRIGGER "proposal_section_history_append_only" BEFORE UPDATE OR DELETE ON "proposal_technical_section_history" FOR EACH ROW EXECUTE FUNCTION "reject_proposal_section_history_mutation"();
