CREATE TYPE "CompetitionActType" AS ENUM ('JUDGMENT','DILIGENCE','APPEAL','COUNTERARGUMENT','DECISION');

CREATE TABLE competition_acts (
  id uuid PRIMARY KEY,
  "competitionId" uuid NOT NULL REFERENCES competitions(id),
  "participantId" uuid REFERENCES competition_participants(id),
  "actKey" uuid NOT NULL,
  version integer NOT NULL CHECK(version > 0),
  "previousVersionId" uuid REFERENCES competition_acts(id),
  type "CompetitionActType" NOT NULL,
  summary text NOT NULL,
  "judgmentClassification" varchar(200),
  qualification varchar(200),
  criterion varchar(1000),
  "actDate" date NOT NULL,
  "deadlineAt" timestamptz,
  "documentVersionId" uuid NOT NULL REFERENCES managed_document_versions(id),
  "documentFileHash" char(64) NOT NULL,
  "sourceReference" varchar(500) NOT NULL,
  "sourceDate" date NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "createdBy" uuid NOT NULL REFERENCES users(id),
  "correlationId" uuid NOT NULL,
  UNIQUE("actKey",version),
  CHECK(length(btrim(summary)) >= 3),
  CHECK("documentFileHash" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX competition_acts_competition_type_date_idx ON competition_acts("competitionId",type,"actDate");
CREATE INDEX competition_acts_participant_idx ON competition_acts("participantId");
CREATE INDEX competition_acts_previous_idx ON competition_acts("previousVersionId");
CREATE INDEX competition_acts_document_idx ON competition_acts("documentVersionId");

CREATE FUNCTION gsipro_validate_competition_act() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous competition_acts; expected_hash char(64);
BEGIN
  IF NEW."participantId" IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM competition_participants WHERE id=NEW."participantId" AND "competitionId"=NEW."competitionId"
  ) THEN RAISE EXCEPTION 'O participante deve pertencer à concorrência.' USING ERRCODE='check_violation'; END IF;

  SELECT "fileHash" INTO expected_hash FROM managed_document_versions WHERE id=NEW."documentVersionId";
  IF expected_hash IS NULL OR expected_hash<>NEW."documentFileHash" THEN
    RAISE EXCEPTION 'O hash documental deve corresponder à versão vinculada.' USING ERRCODE='check_violation';
  END IF;

  IF NEW.type='JUDGMENT' AND (NEW."participantId" IS NULL OR NULLIF(btrim(NEW."judgmentClassification"),'') IS NULL OR NULLIF(btrim(NEW.qualification),'') IS NULL OR NULLIF(btrim(NEW.criterion),'') IS NULL) THEN
    RAISE EXCEPTION 'Julgamento exige participante, classificação, habilitação e critério.' USING ERRCODE='check_violation';
  END IF;
  IF NEW.type IN ('DILIGENCE','APPEAL','COUNTERARGUMENT') AND NEW."deadlineAt" IS NULL THEN
    RAISE EXCEPTION 'Diligência, recurso ou contrarrazão exige prazo.' USING ERRCODE='check_violation';
  END IF;

  IF NEW.version=1 THEN
    IF NEW."previousVersionId" IS NOT NULL THEN RAISE EXCEPTION 'Ato inicial não possui versão anterior.' USING ERRCODE='check_violation'; END IF;
  ELSE
    SELECT * INTO previous FROM competition_acts WHERE id=NEW."previousVersionId";
    IF previous.id IS NULL OR previous."competitionId"<>NEW."competitionId" OR previous."actKey"<>NEW."actKey" OR previous.version<>NEW.version-1 THEN
      RAISE EXCEPTION 'Cadeia de versões do ato inválida.' USING ERRCODE='check_violation';
    END IF;
    IF EXISTS(SELECT 1 FROM competition_acts WHERE "actKey"=NEW."actKey" AND version>previous.version) THEN
      RAISE EXCEPTION 'A revisão deve partir da versão mais recente do ato.' USING ERRCODE='check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_competition_act BEFORE INSERT ON competition_acts FOR EACH ROW EXECUTE FUNCTION gsipro_validate_competition_act();
CREATE TRIGGER trg_competition_acts_append_only BEFORE UPDATE OR DELETE ON competition_acts FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
