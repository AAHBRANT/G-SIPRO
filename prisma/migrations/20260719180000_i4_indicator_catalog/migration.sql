CREATE TABLE indicator_definitions(
  id uuid PRIMARY KEY,"indicatorKey" uuid NOT NULL,version integer NOT NULL CHECK(version>0),"previousVersionId" uuid REFERENCES indicator_definitions(id),
  code varchar(80) NOT NULL,name varchar(200) NOT NULL,purpose varchar(1000) NOT NULL,"ownerId" uuid NOT NULL REFERENCES users(id),
  "numeratorDefinition" text NOT NULL,"denominatorDefinition" text NOT NULL,"treatmentDefinition" text NOT NULL,granularity varchar(500) NOT NULL,
  "sourceMappings" jsonb NOT NULL,dimensions jsonb NOT NULL,"refreshPeriodicity" varchar(200) NOT NULL,"refreshTime" varchar(80) NOT NULL,
  "accessRule" varchar(1000) NOT NULL,"rowSecurityRule" varchar(1000) NOT NULL,"qualityTest" varchar(1000) NOT NULL,"qualityTolerance" varchar(500) NOT NULL,
  "qualityOwnerId" uuid NOT NULL REFERENCES users(id),"effectiveFrom" date NOT NULL,"changeReason" varchar(1000) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),"createdBy" uuid NOT NULL REFERENCES users(id),"correlationId" uuid NOT NULL,
  UNIQUE("indicatorKey",version),CHECK(jsonb_typeof("sourceMappings")='array' AND jsonb_array_length("sourceMappings")>0),CHECK(jsonb_typeof(dimensions)='array' AND jsonb_array_length(dimensions)>0)
);
CREATE INDEX indicator_definitions_code_effective_idx ON indicator_definitions(code,"effectiveFrom");
CREATE INDEX indicator_definitions_previous_idx ON indicator_definitions("previousVersionId");
CREATE INDEX indicator_definitions_owner_idx ON indicator_definitions("ownerId");
CREATE INDEX indicator_definitions_quality_owner_idx ON indicator_definitions("qualityOwnerId");

CREATE TABLE indicator_approvals(
  id uuid PRIMARY KEY,"definitionId" uuid NOT NULL UNIQUE REFERENCES indicator_definitions(id),note varchar(1000) NOT NULL,"approvedAt" timestamptz NOT NULL,"approvedBy" uuid NOT NULL REFERENCES users(id),
  "correlationId" uuid NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX indicator_approvals_approved_at_idx ON indicator_approvals("approvedAt");

CREATE FUNCTION gsipro_validate_indicator_definition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous indicator_definitions;
BEGIN
  IF NEW.version=1 THEN
    IF NEW."previousVersionId" IS NOT NULL OR EXISTS(SELECT 1 FROM indicator_definitions WHERE code=NEW.code) THEN RAISE EXCEPTION 'Código de indicador já existente ou cadeia inicial inválida.' USING ERRCODE='check_violation'; END IF;
  ELSE
    SELECT * INTO previous FROM indicator_definitions WHERE id=NEW."previousVersionId";
    IF previous.id IS NULL OR previous."indicatorKey"<>NEW."indicatorKey" OR previous.code<>NEW.code OR previous.version<>NEW.version-1 THEN RAISE EXCEPTION 'Cadeia de versões do indicador inválida.' USING ERRCODE='check_violation'; END IF;
    IF EXISTS(SELECT 1 FROM indicator_definitions WHERE "indicatorKey"=NEW."indicatorKey" AND version>previous.version) THEN RAISE EXCEPTION 'A revisão deve partir da definição mais recente.' USING ERRCODE='check_violation'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_indicator_definition BEFORE INSERT ON indicator_definitions FOR EACH ROW EXECUTE FUNCTION gsipro_validate_indicator_definition();

CREATE FUNCTION gsipro_validate_indicator_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE definition indicator_definitions;actor_active boolean;has_permission boolean;
BEGIN
  SELECT * INTO definition FROM indicator_definitions WHERE id=NEW."definitionId";
  IF definition.id IS NULL OR EXISTS(SELECT 1 FROM indicator_definitions WHERE "indicatorKey"=definition."indicatorKey" AND version>definition.version) THEN RAISE EXCEPTION 'Somente a definição mais recente pode ser aprovada.' USING ERRCODE='check_violation'; END IF;
  IF definition."createdBy"=NEW."approvedBy" THEN RAISE EXCEPTION 'O autor não pode aprovar a própria definição.' USING ERRCODE='check_violation'; END IF;
  SELECT EXISTS(SELECT 1 FROM users WHERE id=NEW."approvedBy" AND status='ACTIVE') INTO actor_active;
  SELECT EXISTS(SELECT 1 FROM user_profiles up JOIN profiles p ON p.id=up."profileId" AND p.active JOIN profile_permissions pp ON pp."profileId"=p.id JOIN permissions permission ON permission.id=pp."permissionId" WHERE up."userId"=NEW."approvedBy" AND up."validFrom"<=NEW."approvedAt" AND (up."validTo" IS NULL OR up."validTo">NEW."approvedAt") AND permission.code='indicators.approve') INTO has_permission;
  IF NOT actor_active OR NOT has_permission THEN RAISE EXCEPTION 'Aprovador ativo e autorizado é obrigatório.' USING ERRCODE='check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_indicator_approval BEFORE INSERT ON indicator_approvals FOR EACH ROW EXECUTE FUNCTION gsipro_validate_indicator_approval();

CREATE TRIGGER trg_indicator_definitions_append_only BEFORE UPDATE OR DELETE ON indicator_definitions FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
CREATE TRIGGER trg_indicator_approvals_append_only BEFORE UPDATE OR DELETE ON indicator_approvals FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();

INSERT INTO permissions(id,code,module,action,description,"createdAt","createdBy") VALUES
('e4400000-0000-4000-8000-000000000001','indicators.read','indicators','read','Consultar catálogo versionado de indicadores.',now(),'00000000-0000-0000-0000-000000000000'),
('e4400000-0000-4000-8000-000000000002','indicators.manage','indicators','manage','Cadastrar e revisar definições de indicadores.',now(),'00000000-0000-0000-0000-000000000000'),
('e4400000-0000-4000-8000-000000000003','indicators.approve','indicators','approve','Aprovar fórmula e granularidade de indicador com segregação.',now(),'00000000-0000-0000-0000-000000000000');
INSERT INTO profile_permissions("profileId","permissionId","grantedAt","grantedBy") SELECT 'a2100000-0000-4000-8000-000000000001',id,now(),'00000000-0000-0000-0000-000000000000' FROM permissions WHERE code IN('indicators.read','indicators.manage','indicators.approve');
