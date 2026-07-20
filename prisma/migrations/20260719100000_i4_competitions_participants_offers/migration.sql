CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT','ACTIVE','VALIDATED');
CREATE TYPE "CompetitionFactStatus" AS ENUM ('ESTIMATED','CONFIRMED');
CREATE TYPE "CompetitionParticipantStatus" AS ENUM ('EXPECTED','PARTICIPATING','WITHDRAWN');

CREATE TABLE competitors (
  id uuid PRIMARY KEY, "legalName" varchar(300) NOT NULL, "tradeName" varchar(300),
  "normalizedName" varchar(300) NOT NULL UNIQUE, "knownNames" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "createdBy" uuid NOT NULL REFERENCES users(id),
  "updatedAt" timestamptz NOT NULL, "updatedBy" uuid NOT NULL REFERENCES users(id)
);

CREATE TABLE competitions (
  id uuid PRIMARY KEY, "tenderId" uuid NOT NULL REFERENCES tenders(id),
  "tenderLotId" uuid NOT NULL UNIQUE REFERENCES tender_lots(id), "competitionDate" date NOT NULL,
  status "CompetitionStatus" NOT NULL DEFAULT 'DRAFT', "sourceReference" varchar(500) NOT NULL,
  "sourceDate" date NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(),
  "createdBy" uuid NOT NULL REFERENCES users(id), "updatedAt" timestamptz NOT NULL,
  "updatedBy" uuid NOT NULL REFERENCES users(id)
);
CREATE INDEX competitions_tender_status_idx ON competitions("tenderId",status);

CREATE TABLE competition_participants (
  id uuid PRIMARY KEY, "competitionId" uuid NOT NULL REFERENCES competitions(id),
  "competitorId" uuid NOT NULL REFERENCES competitors(id), status "CompetitionParticipantStatus" NOT NULL,
  "factStatus" "CompetitionFactStatus" NOT NULL, "sourceReference" varchar(500) NOT NULL,
  "sourceDate" date NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(),
  "createdBy" uuid NOT NULL REFERENCES users(id), UNIQUE("competitionId","competitorId")
);
CREATE INDEX competition_participants_competitor_idx ON competition_participants("competitorId");

CREATE TABLE competition_offers (
  id uuid PRIMARY KEY, "participantId" uuid NOT NULL REFERENCES competition_participants(id),
  "offerKey" uuid NOT NULL, version integer NOT NULL CHECK(version > 0),
  "previousVersionId" uuid REFERENCES competition_offers(id), amount numeric(19,4) NOT NULL CHECK(amount >= 0),
  currency char(3) NOT NULL, "offerDate" date NOT NULL, "factStatus" "CompetitionFactStatus" NOT NULL,
  "sourceReference" varchar(500) NOT NULL, "sourceDate" date NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "createdBy" uuid NOT NULL REFERENCES users(id),
  "correlationId" uuid NOT NULL, UNIQUE("offerKey",version)
);
CREATE INDEX competition_offers_participant_date_idx ON competition_offers("participantId","offerDate");
CREATE INDEX competition_offers_previous_idx ON competition_offers("previousVersionId");

CREATE FUNCTION gsipro_validate_competition_lot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tender_lots WHERE id=NEW."tenderLotId" AND "tenderId"=NEW."tenderId") THEN
    RAISE EXCEPTION 'O lote deve pertencer ao edital da concorrência.' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_competition_lot BEFORE INSERT OR UPDATE ON competitions FOR EACH ROW EXECUTE FUNCTION gsipro_validate_competition_lot();

CREATE FUNCTION gsipro_validate_offer_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous competition_offers;
BEGIN
  IF NEW.version=1 THEN
    IF NEW."previousVersionId" IS NOT NULL THEN RAISE EXCEPTION 'Oferta inicial não possui versão anterior.' USING ERRCODE='check_violation'; END IF;
  ELSE
    SELECT * INTO previous FROM competition_offers WHERE id=NEW."previousVersionId";
    IF previous.id IS NULL OR previous."participantId"<>NEW."participantId" OR previous."offerKey"<>NEW."offerKey" OR previous.version<>NEW.version-1 THEN
      RAISE EXCEPTION 'Cadeia de versões da oferta inválida.' USING ERRCODE='check_violation';
    END IF;
    IF EXISTS(SELECT 1 FROM competition_offers WHERE "offerKey"=NEW."offerKey" AND version>previous.version) THEN
      RAISE EXCEPTION 'A revisão deve partir da oferta mais recente.' USING ERRCODE='check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_offer_chain BEFORE INSERT ON competition_offers FOR EACH ROW EXECUTE FUNCTION gsipro_validate_offer_chain();

CREATE FUNCTION gsipro_competition_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Registro histórico de concorrência é imutável.' USING ERRCODE='check_violation'; END $$;
CREATE TRIGGER trg_competition_offers_append_only BEFORE UPDATE OR DELETE ON competition_offers FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();

INSERT INTO permissions(id,code,module,action,description,"createdAt","createdBy") VALUES
('e4100000-0000-4000-8000-000000000001','competitions.read','competitions','read','Consultar concorrentes, participantes e ofertas.',now(),'00000000-0000-0000-0000-000000000000'),
('e4100000-0000-4000-8000-000000000002','competitions.manage','competitions','manage','Cadastrar concorrência, participantes e ofertas.',now(),'00000000-0000-0000-0000-000000000000');
INSERT INTO profile_permissions("profileId","permissionId","grantedAt","grantedBy") VALUES
('a2100000-0000-4000-8000-000000000001','e4100000-0000-4000-8000-000000000001',now(),'00000000-0000-0000-0000-000000000000'),
('a2100000-0000-4000-8000-000000000001','e4100000-0000-4000-8000-000000000002',now(),'00000000-0000-0000-0000-000000000000');
