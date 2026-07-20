CREATE TYPE "AiExtractionStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE ai_extraction_executions (
  id uuid PRIMARY KEY,
  "idempotencyKey" varchar(120) NOT NULL UNIQUE,
  "definitionId" uuid NOT NULL REFERENCES ai_use_case_definitions(id) ON DELETE RESTRICT,
  "modelVersionId" uuid NOT NULL REFERENCES ai_model_versions(id) ON DELETE RESTRICT,
  "documentVersionId" uuid NOT NULL REFERENCES managed_document_versions(id) ON DELETE RESTRICT,
  "documentFileHash" char(64) NOT NULL,
  "requestedFields" jsonb NOT NULL,
  instructions text,
  "inputHash" char(64) NOT NULL,
  status "AiExtractionStatus" NOT NULL,
  output jsonb,
  confidence decimal(5,4),
  limitations jsonb,
  "providerResponseId" varchar(200),
  "errorCode" varchar(120),
  "errorMessage" varchar(500),
  "startedAt" timestamptz(6) NOT NULL,
  "completedAt" timestamptz(6),
  "createdBy" uuid NOT NULL,
  "correlationId" uuid NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT ai_extraction_confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);
CREATE INDEX ai_extraction_executions_definition_started_idx ON ai_extraction_executions("definitionId", "startedAt");
CREATE INDEX ai_extraction_executions_document_started_idx ON ai_extraction_executions("documentVersionId", "startedAt");
CREATE INDEX ai_extraction_executions_status_started_idx ON ai_extraction_executions(status, "startedAt");
CREATE INDEX ai_extraction_executions_input_hash_idx ON ai_extraction_executions("inputHash");

CREATE TABLE ai_extraction_evidence (
  id uuid PRIMARY KEY,
  "executionId" uuid NOT NULL REFERENCES ai_extraction_executions(id) ON DELETE RESTRICT,
  "documentVersionId" uuid NOT NULL REFERENCES managed_document_versions(id) ON DELETE RESTRICT,
  "documentFileHash" char(64) NOT NULL,
  excerpt text NOT NULL,
  locator varchar(500) NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX ai_extraction_evidence_execution_idx ON ai_extraction_evidence("executionId");
CREATE INDEX ai_extraction_evidence_document_idx ON ai_extraction_evidence("documentVersionId");

CREATE FUNCTION gsipro_validate_ai_extraction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE definition_record record; document_hash char(64); latest_id uuid;
BEGIN
  IF NEW.status <> 'RUNNING' OR NEW."completedAt" IS NOT NULL OR NEW.output IS NOT NULL OR NEW.confidence IS NOT NULL THEN
    RAISE EXCEPTION 'Nova execução de IA deve iniciar sem resultado e com status RUNNING.';
  END IF;
  SELECT d."modelVersionId", m.status INTO definition_record
    FROM ai_use_case_definitions d JOIN ai_model_versions m ON m.id=d."modelVersionId"
    WHERE d.id=NEW."definitionId" AND EXISTS(SELECT 1 FROM ai_use_case_approvals a WHERE a."definitionId"=d.id);
  IF NOT FOUND OR definition_record."modelVersionId" <> NEW."modelVersionId" OR definition_record.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Execução exige caso aprovado e modelo ativo correspondente.';
  END IF;
  SELECT id INTO latest_id FROM ai_use_case_definitions
    WHERE "useCaseKey"=(SELECT "useCaseKey" FROM ai_use_case_definitions WHERE id=NEW."definitionId")
    ORDER BY version DESC LIMIT 1;
  IF latest_id <> NEW."definitionId" THEN RAISE EXCEPTION 'Execução exige a versão mais recente do caso de uso.'; END IF;
  SELECT "fileHash" INTO document_hash FROM managed_document_versions WHERE id=NEW."documentVersionId";
  IF document_hash IS NULL OR document_hash <> NEW."documentFileHash" THEN RAISE EXCEPTION 'Hash da fonte documental divergente.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_ai_extraction BEFORE INSERT ON ai_extraction_executions FOR EACH ROW EXECUTE FUNCTION gsipro_validate_ai_extraction();

CREATE FUNCTION gsipro_guard_ai_extraction_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'RUNNING' OR NEW.status NOT IN ('SUCCEEDED','FAILED') OR NEW."completedAt" IS NULL THEN
    RAISE EXCEPTION 'Transição de execução de IA inválida.';
  END IF;
  IF ROW(OLD.id,OLD."idempotencyKey",OLD."definitionId",OLD."modelVersionId",OLD."documentVersionId",OLD."documentFileHash",OLD."requestedFields",OLD.instructions,OLD."inputHash",OLD."startedAt",OLD."createdBy",OLD."correlationId",OLD."createdAt")
     IS DISTINCT FROM ROW(NEW.id,NEW."idempotencyKey",NEW."definitionId",NEW."modelVersionId",NEW."documentVersionId",NEW."documentFileHash",NEW."requestedFields",NEW.instructions,NEW."inputHash",NEW."startedAt",NEW."createdBy",NEW."correlationId",NEW."createdAt") THEN
    RAISE EXCEPTION 'Dados de entrada da execução de IA são imutáveis.';
  END IF;
  IF NEW.status='SUCCEEDED' AND (NEW.output IS NULL OR NEW.confidence IS NULL OR NEW.limitations IS NULL OR NEW."providerResponseId" IS NULL OR NEW."errorCode" IS NOT NULL) THEN
    RAISE EXCEPTION 'Execução concluída exige resultado, confiança, limitações e resposta do provedor.';
  END IF;
  IF NEW.status='FAILED' AND (NEW."errorCode" IS NULL OR NEW.output IS NOT NULL) THEN
    RAISE EXCEPTION 'Execução falha exige código de erro e não pode conter resultado.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_ai_extraction_update BEFORE UPDATE ON ai_extraction_executions FOR EACH ROW EXECUTE FUNCTION gsipro_guard_ai_extraction_update();
CREATE FUNCTION gsipro_deny_ai_extraction_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Registros de execução de IA são imutáveis.'; END $$;
CREATE TRIGGER trg_deny_ai_extraction_delete BEFORE DELETE ON ai_extraction_executions FOR EACH ROW EXECUTE FUNCTION gsipro_deny_ai_extraction_delete();

CREATE FUNCTION gsipro_validate_ai_extraction_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_version uuid; source_hash char(64);
BEGIN
  SELECT "documentVersionId","documentFileHash" INTO source_version,source_hash FROM ai_extraction_executions WHERE id=NEW."executionId";
  IF source_version IS NULL OR source_version <> NEW."documentVersionId" OR source_hash <> NEW."documentFileHash" THEN
    RAISE EXCEPTION 'Evidência de IA deve apontar para a mesma fonte imutável da execução.';
  END IF;
  IF btrim(NEW.excerpt)='' OR btrim(NEW.locator)='' THEN RAISE EXCEPTION 'Evidência de IA exige trecho e localizador.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_ai_extraction_evidence BEFORE INSERT ON ai_extraction_evidence FOR EACH ROW EXECUTE FUNCTION gsipro_validate_ai_extraction_evidence();
CREATE TRIGGER trg_deny_ai_extraction_evidence_update BEFORE UPDATE OR DELETE ON ai_extraction_evidence FOR EACH ROW EXECUTE FUNCTION gsipro_deny_ai_extraction_delete();

INSERT INTO permissions(id,code,module,action,description,"createdAt","createdBy") VALUES
('e5200000-0000-4000-8000-000000000001','ai.execute','ai','execute','Executar caso de uso de IA aprovado sobre fonte documental autorizada.',now(),'00000000-0000-0000-0000-000000000000');
INSERT INTO profile_permissions("profileId","permissionId","grantedAt","grantedBy")
SELECT 'a2100000-0000-4000-8000-000000000001',id,now(),'00000000-0000-0000-0000-000000000000' FROM permissions WHERE code='ai.execute';
