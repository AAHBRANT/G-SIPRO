CREATE TYPE "CompetitionOutcome" AS ENUM ('WIN','LOSS','DISQUALIFICATION','CANCELLATION');
CREATE TYPE "CompetitionMotiveStatus" AS ENUM ('ACTIVE','INACTIVE');

CREATE TABLE competition_motive_categories(
  id uuid PRIMARY KEY,"categoryKey" uuid NOT NULL,version integer NOT NULL CHECK(version>0),"previousVersionId" uuid REFERENCES competition_motive_categories(id),
  code varchar(80) NOT NULL,name varchar(200) NOT NULL,definition varchar(1000) NOT NULL,"applicableOutcome" "CompetitionOutcome",status "CompetitionMotiveStatus" NOT NULL,
  "changeReason" varchar(1000) NOT NULL,"sourceReference" varchar(500) NOT NULL,"sourceDate" date NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),"createdBy" uuid NOT NULL REFERENCES users(id),"correlationId" uuid NOT NULL,
  UNIQUE("categoryKey",version)
);
CREATE INDEX competition_motive_code_status_idx ON competition_motive_categories(code,status);
CREATE INDEX competition_motive_previous_idx ON competition_motive_categories("previousVersionId");

CREATE TABLE competition_results(
  id uuid PRIMARY KEY,"competitionId" uuid NOT NULL REFERENCES competitions(id),version integer NOT NULL CHECK(version>0),"previousVersionId" uuid REFERENCES competition_results(id),
  outcome "CompetitionOutcome" NOT NULL,"winningParticipantId" uuid REFERENCES competition_participants(id),"motiveCategoryId" uuid NOT NULL REFERENCES competition_motive_categories(id),
  justification text NOT NULL,"resultDate" date NOT NULL,"documentVersionId" uuid NOT NULL REFERENCES managed_document_versions(id),"documentFileHash" char(64) NOT NULL,
  "sourceReference" varchar(500) NOT NULL,"sourceDate" date NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now(),"createdBy" uuid NOT NULL REFERENCES users(id),"correlationId" uuid NOT NULL,
  UNIQUE("competitionId",version),CHECK(length(btrim(justification))>=3),CHECK("documentFileHash"~'^[a-f0-9]{64}$')
);
CREATE INDEX competition_results_outcome_date_idx ON competition_results(outcome,"resultDate");
CREATE INDEX competition_results_previous_idx ON competition_results("previousVersionId");
CREATE INDEX competition_results_motive_idx ON competition_results("motiveCategoryId");
CREATE INDEX competition_results_document_idx ON competition_results("documentVersionId");

CREATE TABLE competition_result_validations(
  id uuid PRIMARY KEY,"resultId" uuid NOT NULL UNIQUE REFERENCES competition_results(id),note varchar(1000) NOT NULL,"validatedAt" timestamptz NOT NULL,"validatedBy" uuid NOT NULL REFERENCES users(id),
  "correlationId" uuid NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX competition_result_validated_at_idx ON competition_result_validations("validatedAt");

CREATE FUNCTION gsipro_validate_motive_category() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous competition_motive_categories;
BEGIN
  IF NEW.version=1 THEN
    IF NEW."previousVersionId" IS NOT NULL THEN RAISE EXCEPTION 'Categoria inicial não possui versão anterior.' USING ERRCODE='check_violation'; END IF;
  ELSE
    SELECT * INTO previous FROM competition_motive_categories WHERE id=NEW."previousVersionId";
    IF previous.id IS NULL OR previous."categoryKey"<>NEW."categoryKey" OR previous.code<>NEW.code OR previous.version<>NEW.version-1 THEN RAISE EXCEPTION 'Cadeia da categoria de motivo inválida.' USING ERRCODE='check_violation'; END IF;
    IF EXISTS(SELECT 1 FROM competition_motive_categories WHERE "categoryKey"=NEW."categoryKey" AND version>previous.version) THEN RAISE EXCEPTION 'A revisão deve partir da categoria mais recente.' USING ERRCODE='check_violation'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_motive_category BEFORE INSERT ON competition_motive_categories FOR EACH ROW EXECUTE FUNCTION gsipro_validate_motive_category();

CREATE FUNCTION gsipro_validate_competition_result() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous competition_results;category competition_motive_categories;document_hash char(64);
BEGIN
  IF NEW."winningParticipantId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM competition_participants WHERE id=NEW."winningParticipantId" AND "competitionId"=NEW."competitionId") THEN RAISE EXCEPTION 'O vencedor deve pertencer à concorrência.' USING ERRCODE='check_violation'; END IF;
  SELECT * INTO category FROM competition_motive_categories WHERE id=NEW."motiveCategoryId";
  IF category.id IS NULL OR category.status<>'ACTIVE' OR (category."applicableOutcome" IS NOT NULL AND category."applicableOutcome"<>NEW.outcome) THEN RAISE EXCEPTION 'Categoria de motivo inativa ou incompatível com o resultado.' USING ERRCODE='check_violation'; END IF;
  IF EXISTS(SELECT 1 FROM competition_motive_categories c WHERE c."categoryKey"=category."categoryKey" AND c.version>category.version) THEN RAISE EXCEPTION 'Utilize a versão mais recente da categoria de motivo.' USING ERRCODE='check_violation'; END IF;
  SELECT "fileHash" INTO document_hash FROM managed_document_versions WHERE id=NEW."documentVersionId";
  IF document_hash IS NULL OR document_hash<>NEW."documentFileHash" THEN RAISE EXCEPTION 'O hash documental deve corresponder à versão vinculada.' USING ERRCODE='check_violation'; END IF;
  IF NEW.version=1 THEN
    IF NEW."previousVersionId" IS NOT NULL OR EXISTS(SELECT 1 FROM competition_results WHERE "competitionId"=NEW."competitionId") THEN RAISE EXCEPTION 'Resultado inicial ou cadeia da concorrência inválida.' USING ERRCODE='check_violation'; END IF;
  ELSE
    SELECT * INTO previous FROM competition_results WHERE id=NEW."previousVersionId";
    IF previous.id IS NULL OR previous."competitionId"<>NEW."competitionId" OR previous.version<>NEW.version-1 THEN RAISE EXCEPTION 'Cadeia de versões do resultado inválida.' USING ERRCODE='check_violation'; END IF;
    IF EXISTS(SELECT 1 FROM competition_results WHERE "competitionId"=NEW."competitionId" AND version>previous.version) THEN RAISE EXCEPTION 'A revisão deve partir do resultado mais recente.' USING ERRCODE='check_violation'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_competition_result BEFORE INSERT ON competition_results FOR EACH ROW EXECUTE FUNCTION gsipro_validate_competition_result();

CREATE FUNCTION gsipro_validate_result_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE result_record competition_results;category competition_motive_categories;actor_active boolean;has_permission boolean;
BEGIN
  SELECT * INTO result_record FROM competition_results WHERE id=NEW."resultId";
  IF result_record.id IS NULL OR EXISTS(SELECT 1 FROM competition_results WHERE "competitionId"=result_record."competitionId" AND version>result_record.version) THEN RAISE EXCEPTION 'Somente o resultado mais recente pode ser validado.' USING ERRCODE='check_violation'; END IF;
  IF result_record."createdBy"=NEW."validatedBy" THEN RAISE EXCEPTION 'O autor não pode validar o próprio resultado.' USING ERRCODE='check_violation'; END IF;
  SELECT * INTO category FROM competition_motive_categories WHERE id=result_record."motiveCategoryId";
  IF category.status<>'ACTIVE' OR EXISTS(SELECT 1 FROM competition_motive_categories c WHERE c."categoryKey"=category."categoryKey" AND c.version>category.version) THEN RAISE EXCEPTION 'A categoria do resultado não é a versão ativa mais recente.' USING ERRCODE='check_violation'; END IF;
  SELECT EXISTS(SELECT 1 FROM users WHERE id=NEW."validatedBy" AND status='ACTIVE') INTO actor_active;
  SELECT EXISTS(SELECT 1 FROM user_profiles up JOIN profiles p ON p.id=up."profileId" AND p.active JOIN profile_permissions pp ON pp."profileId"=p.id JOIN permissions permission ON permission.id=pp."permissionId" WHERE up."userId"=NEW."validatedBy" AND up."validFrom"<=NEW."validatedAt" AND (up."validTo" IS NULL OR up."validTo">NEW."validatedAt") AND permission.code='competitions.validate-result') INTO has_permission;
  IF NOT actor_active OR NOT has_permission THEN RAISE EXCEPTION 'Validador ativo e autorizado é obrigatório.' USING ERRCODE='check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_result_approval BEFORE INSERT ON competition_result_validations FOR EACH ROW EXECUTE FUNCTION gsipro_validate_result_approval();

CREATE TRIGGER trg_motive_categories_append_only BEFORE UPDATE OR DELETE ON competition_motive_categories FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
CREATE TRIGGER trg_competition_results_append_only BEFORE UPDATE OR DELETE ON competition_results FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
CREATE TRIGGER trg_result_validations_append_only BEFORE UPDATE OR DELETE ON competition_result_validations FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();

INSERT INTO permissions(id,code,module,action,description,"createdAt","createdBy") VALUES('e4300000-0000-4000-8000-000000000001','competitions.validate-result','competitions','validate-result','Validar resultado final de concorrência com segregação de função.',now(),'00000000-0000-0000-0000-000000000000');
INSERT INTO profile_permissions("profileId","permissionId","grantedAt","grantedBy") VALUES('a2100000-0000-4000-8000-000000000001','e4300000-0000-4000-8000-000000000001',now(),'00000000-0000-0000-0000-000000000000');
