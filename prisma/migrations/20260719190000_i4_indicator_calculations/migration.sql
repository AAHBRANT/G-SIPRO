CREATE TYPE "IndicatorCalculationMethod" AS ENUM('PIPELINE_COUNT','PIPELINE_VALUE','RESULT_CONVERSION_RATE','FINANCIAL_CONVERSION_RATE','AVERAGE_DISCOUNT_PERCENT','AVERAGE_MARGIN_PERCENT');
ALTER TABLE indicator_definitions ADD COLUMN "calculationMethod" "IndicatorCalculationMethod";

CREATE TABLE competition_awards(
  id uuid PRIMARY KEY,"resultId" uuid NOT NULL UNIQUE REFERENCES competition_results(id),"contractValue" numeric(19,4) NOT NULL CHECK("contractValue">=0),currency char(3) NOT NULL,
  "documentVersionId" uuid NOT NULL REFERENCES managed_document_versions(id),"documentFileHash" char(64) NOT NULL,"sourceReference" varchar(500) NOT NULL,"sourceDate" date NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),"createdBy" uuid NOT NULL REFERENCES users(id),"correlationId" uuid NOT NULL,CHECK("documentFileHash"~'^[a-f0-9]{64}$')
);
CREATE INDEX competition_awards_currency_date_idx ON competition_awards(currency,"sourceDate");
CREATE INDEX competition_awards_document_idx ON competition_awards("documentVersionId");

CREATE TABLE indicator_snapshots(
  id uuid PRIMARY KEY,"definitionId" uuid NOT NULL REFERENCES indicator_definitions(id),"calculationMethod" "IndicatorCalculationMethod" NOT NULL,"periodStart" date NOT NULL,"periodEnd" date NOT NULL,currency char(3),
  numerator numeric(24,8) NOT NULL,denominator numeric(24,8),value numeric(24,8) NOT NULL,unit varchar(40) NOT NULL,"sourceRecordCount" integer NOT NULL CHECK("sourceRecordCount">=0),
  "sourcePayload" jsonb NOT NULL,"payloadHash" char(64) NOT NULL,"calculatedAt" timestamptz NOT NULL,"calculatedBy" uuid NOT NULL REFERENCES users(id),"correlationId" uuid NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK("periodEnd">="periodStart"),CHECK("payloadHash"~'^[a-f0-9]{64}$'),UNIQUE("definitionId","periodStart","periodEnd",currency,"payloadHash")
);
CREATE INDEX indicator_snapshots_definition_calculated_idx ON indicator_snapshots("definitionId","calculatedAt");
CREATE INDEX indicator_snapshots_hash_idx ON indicator_snapshots("payloadHash");

CREATE FUNCTION gsipro_validate_competition_award() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE result_record competition_results;document_hash char(64);
BEGIN
  SELECT * INTO result_record FROM competition_results WHERE id=NEW."resultId";
  IF result_record.id IS NULL OR result_record.outcome<>'WIN' OR NOT EXISTS(SELECT 1 FROM competition_result_validations WHERE "resultId"=result_record.id) THEN RAISE EXCEPTION 'Valor conquistado exige resultado de ganho validado.' USING ERRCODE='check_violation'; END IF;
  IF EXISTS(SELECT 1 FROM competition_results later WHERE later."competitionId"=result_record."competitionId" AND later.version>result_record.version) THEN RAISE EXCEPTION 'Valor conquistado exige a versão mais recente do resultado.' USING ERRCODE='check_violation'; END IF;
  SELECT "fileHash" INTO document_hash FROM managed_document_versions WHERE id=NEW."documentVersionId";
  IF document_hash IS NULL OR document_hash<>NEW."documentFileHash" THEN RAISE EXCEPTION 'O hash documental do contrato deve corresponder à versão vinculada.' USING ERRCODE='check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_competition_award BEFORE INSERT ON competition_awards FOR EACH ROW EXECUTE FUNCTION gsipro_validate_competition_award();

CREATE FUNCTION gsipro_validate_indicator_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE definition indicator_definitions;
BEGIN
  SELECT * INTO definition FROM indicator_definitions WHERE id=NEW."definitionId";
  IF definition.id IS NULL OR definition."calculationMethod" IS NULL OR definition."calculationMethod"<>NEW."calculationMethod" OR NOT EXISTS(SELECT 1 FROM indicator_approvals WHERE "definitionId"=definition.id) THEN RAISE EXCEPTION 'Snapshot exige definição aprovada e método executável correspondente.' USING ERRCODE='check_violation'; END IF;
  IF EXISTS(SELECT 1 FROM indicator_definitions later JOIN indicator_approvals approval ON approval."definitionId"=later.id WHERE later."indicatorKey"=definition."indicatorKey" AND later.version>definition.version AND later."effectiveFrom"<=NEW."periodEnd") THEN RAISE EXCEPTION 'Utilize a versão aprovada vigente no período.' USING ERRCODE='check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_indicator_snapshot BEFORE INSERT ON indicator_snapshots FOR EACH ROW EXECUTE FUNCTION gsipro_validate_indicator_snapshot();
CREATE TRIGGER trg_competition_awards_append_only BEFORE UPDATE OR DELETE ON competition_awards FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
CREATE TRIGGER trg_indicator_snapshots_append_only BEFORE UPDATE OR DELETE ON indicator_snapshots FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();

INSERT INTO permissions(id,code,module,action,description,"createdAt","createdBy") VALUES('e4500000-0000-4000-8000-000000000001','indicators.calculate','indicators','calculate','Executar cálculo governado e persistir snapshot rastreável.',now(),'00000000-0000-0000-0000-000000000000');
INSERT INTO profile_permissions("profileId","permissionId","grantedAt","grantedBy") VALUES('a2100000-0000-4000-8000-000000000001','e4500000-0000-4000-8000-000000000001',now(),'00000000-0000-0000-0000-000000000000');
