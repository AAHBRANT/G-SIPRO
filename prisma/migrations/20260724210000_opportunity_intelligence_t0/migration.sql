CREATE TYPE "OpportunityAnalysisType" AS ENUM ('PRELIMINARY','ENRICHED');
CREATE TYPE "OpportunityAnalysisStatus" AS ENUM ('QUEUED','COLLECTING','CALCULATING','AI_EXPLAINING','WAITING_INFORMATION','WAITING_OWNER','SUCCEEDED','PARTIAL','FAILED');
CREATE TYPE "IntelligencePerspective" AS ENUM ('COMMERCIAL','TECHNICAL','STUDIES');
CREATE TYPE "AnalysisDimensionStatus" AS ENUM ('CALCULATED','NOT_CALCULABLE');
CREATE TYPE "IntelligenceRecommendation" AS ENUM ('RECOMMENDED','RECOMMENDED_WITH_RESTRICTIONS','NOT_RECOMMENDED','WAITING_INFORMATION','WAITING_OWNER_DECISION');
CREATE TYPE "AnalysisPendingStatus" AS ENUM ('OPEN','CONFIRMED','CANCELLED');
CREATE TYPE "CriticalImpedimentType" AS ENUM ('HIGH_INDEBTEDNESS_RISK','NON_PAYING_CUSTOMER');
CREATE TYPE "CriticalImpedimentStatus" AS ENUM ('OPEN','DECIDED');
CREATE TYPE "OpportunityDecisionType" AS ENUM ('PROCEED','PROCEED_WITH_RESTRICTIONS','DO_NOT_PROCEED');

CREATE TABLE intelligence_policies(
  id uuid PRIMARY KEY,
  "policyKey" uuid NOT NULL,
  version integer NOT NULL CHECK(version>0),
  "previousVersionId" uuid REFERENCES intelligence_policies(id),
  code varchar(80) NOT NULL,
  name varchar(200) NOT NULL,
  purpose varchar(1000) NOT NULL,
  dimensions jsonb NOT NULL,
  weights jsonb NOT NULL,
  thresholds jsonb NOT NULL,
  "impedimentRules" jsonb NOT NULL,
  "authorizedSources" jsonb NOT NULL,
  "coverageMinimum" numeric(5,2) NOT NULL CHECK("coverageMinimum"=70.00),
  "effectiveFrom" date NOT NULL,
  "changeReason" varchar(1000) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "createdBy" uuid NOT NULL REFERENCES users(id),
  "correlationId" uuid NOT NULL,
  UNIQUE("policyKey",version),
  CHECK(jsonb_typeof(dimensions)='array' AND jsonb_array_length(dimensions)>=3),
  CHECK(jsonb_typeof(weights)='object'),
  CHECK(jsonb_typeof(thresholds)='object'),
  CHECK(jsonb_typeof("impedimentRules")='array' AND jsonb_array_length("impedimentRules")=2),
  CHECK(jsonb_typeof("authorizedSources")='array' AND jsonb_array_length("authorizedSources")>0)
);
CREATE INDEX intelligence_policies_code_effective_idx ON intelligence_policies(code,"effectiveFrom");
CREATE INDEX intelligence_policies_previous_idx ON intelligence_policies("previousVersionId");

CREATE TABLE intelligence_policy_approvals(
  id uuid PRIMARY KEY,
  "policyId" uuid NOT NULL UNIQUE REFERENCES intelligence_policies(id),
  note varchar(1000) NOT NULL,
  "approvedAt" timestamptz NOT NULL,
  "approvedBy" uuid NOT NULL REFERENCES users(id),
  "correlationId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX intelligence_policy_approvals_approved_at_idx ON intelligence_policy_approvals("approvedAt");

CREATE TABLE opportunity_analyses(
  id uuid PRIMARY KEY,
  "opportunityId" uuid NOT NULL REFERENCES opportunities(id),
  "policyId" uuid NOT NULL REFERENCES intelligence_policies(id),
  version integer NOT NULL CHECK(version>0),
  type "OpportunityAnalysisType" NOT NULL,
  status "OpportunityAnalysisStatus" NOT NULL DEFAULT 'QUEUED',
  "inputHash" char(64) NOT NULL,
  score numeric(7,4) CHECK(score BETWEEN 0 AND 100),
  coverage numeric(7,4) CHECK(coverage BETWEEN 0 AND 100),
  confidence numeric(7,4) CHECK(confidence BETWEEN 0 AND 100),
  recommendation "IntelligenceRecommendation",
  "executiveSummary" text,
  "requestedAt" timestamptz NOT NULL DEFAULT now(),
  "requestedBy" uuid NOT NULL REFERENCES users(id),
  "startedAt" timestamptz,
  "completedAt" timestamptz,
  "correlationId" uuid NOT NULL,
  UNIQUE("opportunityId",version),
  UNIQUE("opportunityId","policyId","inputHash"),
  CHECK("inputHash" ~ '^[0-9a-f]{64}$'),
  CHECK("completedAt" IS NULL OR "startedAt" IS NOT NULL)
);
CREATE INDEX opportunity_analyses_status_idx ON opportunity_analyses("opportunityId",status,"requestedAt");
CREATE INDEX opportunity_analyses_policy_idx ON opportunity_analyses("policyId");
CREATE INDEX opportunity_analyses_correlation_idx ON opportunity_analyses("correlationId");

CREATE TABLE analysis_dimension_results(
  id uuid PRIMARY KEY,
  "analysisId" uuid NOT NULL REFERENCES opportunity_analyses(id),
  perspective "IntelligencePerspective" NOT NULL,
  dimension varchar(120) NOT NULL,
  status "AnalysisDimensionStatus" NOT NULL,
  score numeric(7,4) CHECK(score BETWEEN 0 AND 100),
  weight numeric(7,4) NOT NULL CHECK(weight>0 AND weight<=100),
  confidence numeric(7,4) NOT NULL CHECK(confidence BETWEEN 0 AND 100),
  summary text NOT NULL,
  facts jsonb NOT NULL,
  calculations jsonb NOT NULL,
  inferences jsonb NOT NULL,
  risks jsonb NOT NULL,
  method varchar(160) NOT NULL,
  "methodVersion" varchar(80) NOT NULL,
  "resultHash" char(64) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("analysisId",perspective,dimension),
  CHECK((status='CALCULATED' AND score IS NOT NULL) OR (status='NOT_CALCULABLE' AND score IS NULL)),
  CHECK("resultHash" ~ '^[0-9a-f]{64}$')
);
CREATE INDEX analysis_dimension_results_perspective_idx ON analysis_dimension_results("analysisId",perspective);

CREATE TABLE analysis_evidences(
  id uuid PRIMARY KEY,
  "analysisId" uuid NOT NULL REFERENCES opportunity_analyses(id),
  "dimensionResultId" uuid REFERENCES analysis_dimension_results(id),
  "sourceType" varchar(80) NOT NULL,
  "sourceId" varchar(160),
  "sourceVersion" varchar(80),
  "sourceHash" char(64),
  locator varchar(500),
  excerpt text,
  "referenceDate" timestamptz,
  "obtainedAt" timestamptz NOT NULL DEFAULT now(),
  "accessLevel" varchar(80) NOT NULL,
  "evidenceHash" char(64) NOT NULL,
  UNIQUE("analysisId","evidenceHash"),
  CHECK("sourceHash" IS NULL OR "sourceHash" ~ '^[0-9a-f]{64}$'),
  CHECK("evidenceHash" ~ '^[0-9a-f]{64}$')
);
CREATE INDEX analysis_evidences_dimension_idx ON analysis_evidences("dimensionResultId");
CREATE INDEX analysis_evidences_source_idx ON analysis_evidences("sourceType","sourceId");

CREATE TABLE analysis_pending_items(
  id uuid PRIMARY KEY,
  "analysisId" uuid NOT NULL REFERENCES opportunity_analyses(id),
  "dimensionResultId" uuid REFERENCES analysis_dimension_results(id),
  description varchar(1000) NOT NULL,
  reason varchar(1000) NOT NULL,
  "requiredInformation" varchar(1000) NOT NULL,
  "responsibleId" uuid REFERENCES users(id),
  "dueAt" timestamptz,
  status "AnalysisPendingStatus" NOT NULL DEFAULT 'OPEN',
  response text,
  "confirmedAt" timestamptz,
  "confirmedBy" uuid REFERENCES users(id),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK((status='CONFIRMED' AND "confirmedAt" IS NOT NULL AND "confirmedBy" IS NOT NULL AND response IS NOT NULL) OR status<>'CONFIRMED')
);
CREATE INDEX analysis_pending_items_status_idx ON analysis_pending_items("analysisId",status,"dueAt");
CREATE INDEX analysis_pending_items_responsible_idx ON analysis_pending_items("responsibleId",status);

CREATE TABLE critical_impediments(
  id uuid PRIMARY KEY,
  "analysisId" uuid NOT NULL REFERENCES opportunity_analyses(id),
  type "CriticalImpedimentType" NOT NULL,
  status "CriticalImpedimentStatus" NOT NULL DEFAULT 'OPEN',
  "ruleCode" varchar(120) NOT NULL,
  severity varchar(40) NOT NULL,
  summary varchar(1000) NOT NULL,
  "evidenceSnapshot" jsonb NOT NULL,
  "detectedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("analysisId",type)
);
CREATE INDEX critical_impediments_status_idx ON critical_impediments(status,"detectedAt");

CREATE TABLE opportunity_analysis_decisions(
  id uuid PRIMARY KEY,
  "analysisId" uuid NOT NULL REFERENCES opportunity_analyses(id),
  decision "OpportunityDecisionType" NOT NULL,
  justification varchar(2000) NOT NULL,
  "observedRecommendation" "IntelligenceRecommendation",
  "observedImpediments" jsonb NOT NULL,
  "decidedAt" timestamptz NOT NULL DEFAULT now(),
  "decidedBy" uuid NOT NULL REFERENCES users(id),
  "correlationId" uuid NOT NULL
);
CREATE INDEX opportunity_analysis_decisions_analysis_idx ON opportunity_analysis_decisions("analysisId","decidedAt");
CREATE INDEX opportunity_analysis_decisions_actor_idx ON opportunity_analysis_decisions("decidedBy","decidedAt");

CREATE FUNCTION gsipro_validate_intelligence_policy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous intelligence_policies;
BEGIN
  IF NEW.version=1 THEN
    IF NEW."previousVersionId" IS NOT NULL OR EXISTS(SELECT 1 FROM intelligence_policies WHERE code=NEW.code) THEN
      RAISE EXCEPTION 'Código de política já existente ou cadeia inicial inválida.' USING ERRCODE='check_violation';
    END IF;
  ELSE
    SELECT * INTO previous FROM intelligence_policies WHERE id=NEW."previousVersionId";
    IF previous.id IS NULL OR previous."policyKey"<>NEW."policyKey" OR previous.code<>NEW.code OR previous.version<>NEW.version-1 THEN
      RAISE EXCEPTION 'Cadeia de versões da política inválida.' USING ERRCODE='check_violation';
    END IF;
    IF EXISTS(SELECT 1 FROM intelligence_policies WHERE "policyKey"=NEW."policyKey" AND version>previous.version) THEN
      RAISE EXCEPTION 'A revisão deve partir da política mais recente.' USING ERRCODE='check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_intelligence_policy BEFORE INSERT ON intelligence_policies FOR EACH ROW EXECUTE FUNCTION gsipro_validate_intelligence_policy();

CREATE FUNCTION gsipro_validate_intelligence_policy_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy intelligence_policies;owner_active boolean;
BEGIN
  SELECT * INTO policy FROM intelligence_policies WHERE id=NEW."policyId";
  IF policy.id IS NULL OR EXISTS(SELECT 1 FROM intelligence_policies WHERE "policyKey"=policy."policyKey" AND version>policy.version) THEN
    RAISE EXCEPTION 'Somente a política mais recente pode ser aprovada.' USING ERRCODE='check_violation';
  END IF;
  IF policy."createdBy"=NEW."approvedBy" THEN
    RAISE EXCEPTION 'O autor não pode aprovar a própria política.' USING ERRCODE='check_violation';
  END IF;
  SELECT EXISTS(SELECT 1 FROM users WHERE id=NEW."approvedBy" AND status='ACTIVE' AND "isOwner"=true AND "archivedAt" IS NULL) INTO owner_active;
  IF NOT owner_active THEN
    RAISE EXCEPTION 'Aprovação exclusiva de proprietário ativo.' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_intelligence_policy_approval BEFORE INSERT ON intelligence_policy_approvals FOR EACH ROW EXECUTE FUNCTION gsipro_validate_intelligence_policy_approval();

CREATE FUNCTION gsipro_validate_opportunity_analysis_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_active boolean;has_open_impediment boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM critical_impediments WHERE "analysisId"=NEW."analysisId" AND status='OPEN') INTO has_open_impediment;
  IF NEW.decision<>'DO_NOT_PROCEED' AND (NEW."observedRecommendation"='NOT_RECOMMENDED' OR has_open_impediment) THEN
    SELECT EXISTS(SELECT 1 FROM users WHERE id=NEW."decidedBy" AND status='ACTIVE' AND "isOwner"=true AND "archivedAt" IS NULL) INTO owner_active;
    IF NOT owner_active THEN
      RAISE EXCEPTION 'Somente o proprietário pode superar recomendação não favorável ou impedimento crítico.' USING ERRCODE='insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_opportunity_analysis_decision BEFORE INSERT ON opportunity_analysis_decisions FOR EACH ROW EXECUTE FUNCTION gsipro_validate_opportunity_analysis_decision();

CREATE TRIGGER trg_intelligence_policies_append_only BEFORE UPDATE OR DELETE ON intelligence_policies FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
CREATE TRIGGER trg_intelligence_policy_approvals_append_only BEFORE UPDATE OR DELETE ON intelligence_policy_approvals FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
CREATE TRIGGER trg_analysis_dimension_results_append_only BEFORE UPDATE OR DELETE ON analysis_dimension_results FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
CREATE TRIGGER trg_analysis_evidences_append_only BEFORE UPDATE OR DELETE ON analysis_evidences FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
CREATE TRIGGER trg_opportunity_analysis_decisions_append_only BEFORE UPDATE OR DELETE ON opportunity_analysis_decisions FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();

INSERT INTO permissions(id,code,module,action,description,"createdAt","createdBy") VALUES
('e5900000-0000-4000-8000-000000000001','analytics.read','analytics','read','Consultar análises inteligentes autorizadas.',now(),'00000000-0000-0000-0000-000000000000'),
('e5900000-0000-4000-8000-000000000002','analytics.calculate','analytics','calculate','Solicitar execução de análise inteligente.',now(),'00000000-0000-0000-0000-000000000000'),
('e5900000-0000-4000-8000-000000000003','analytics.confirm','analytics','confirm','Confirmar dados e pendências autorizadas.',now(),'00000000-0000-0000-0000-000000000000'),
('e5900000-0000-4000-8000-000000000004','analytics.configure','analytics','configure','Cadastrar e revisar políticas analíticas.',now(),'00000000-0000-0000-0000-000000000000'),
('e5900000-0000-4000-8000-000000000005','analytics.approve-config','analytics','approve-config','Aprovar política analítica como proprietário.',now(),'00000000-0000-0000-0000-000000000000'),
('e5900000-0000-4000-8000-000000000006','analytics.decide','analytics','decide','Registrar decisão empresarial sobre oportunidade.',now(),'00000000-0000-0000-0000-000000000000'),
('e5900000-0000-4000-8000-000000000007','analytics.override','analytics','override','Superar recomendação não favorável como proprietário.',now(),'00000000-0000-0000-0000-000000000000'),
('e5900000-0000-4000-8000-000000000008','analytics.read-financial','analytics','read-financial','Consultar dados financeiros restritos da análise.',now(),'00000000-0000-0000-0000-000000000000'),
('e5900000-0000-4000-8000-000000000009','analytics.read-client-risk','analytics','read-client-risk','Consultar detalhes restritos de risco do cliente.',now(),'00000000-0000-0000-0000-000000000000');

INSERT INTO profile_permissions("profileId","permissionId","grantedAt","grantedBy")
SELECT 'a2100000-0000-4000-8000-000000000001',id,now(),'00000000-0000-0000-0000-000000000000'
FROM permissions
WHERE code IN('analytics.read','analytics.calculate','analytics.confirm','analytics.configure','analytics.approve-config','analytics.decide','analytics.override','analytics.read-financial','analytics.read-client-risk')
ON CONFLICT DO NOTHING;
