CREATE TYPE "FinancialAssessmentConclusion" AS ENUM(
  'ADEQUATE',
  'HIGH_RISK',
  'INSUFFICIENT_DATA'
);

CREATE TYPE "PaymentRiskClassification" AS ENUM(
  'GOOD_PAYER',
  'ATTENTION',
  'NON_PAYER',
  'INSUFFICIENT_DATA'
);

CREATE TABLE financial_capacity_assessments(
  id uuid PRIMARY KEY,
  "opportunityId" uuid NOT NULL REFERENCES opportunities(id),
  version integer NOT NULL CHECK(version > 0),
  "periodStart" date NOT NULL,
  "periodEnd" date NOT NULL,
  indices jsonb NOT NULL,
  "calculatedResult" jsonb NOT NULL,
  conclusion "FinancialAssessmentConclusion" NOT NULL,
  justification text NOT NULL,
  evidence jsonb NOT NULL,
  "assessmentHash" char(64) NOT NULL CHECK("assessmentHash" ~ '^[0-9a-f]{64}$'),
  "confirmedAt" timestamptz NOT NULL,
  "confirmedBy" uuid NOT NULL REFERENCES users(id),
  "correlationId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK("periodEnd" >= "periodStart"),
  UNIQUE("opportunityId", version),
  UNIQUE("opportunityId", "assessmentHash")
);
CREATE INDEX financial_capacity_assessments_lookup_idx
  ON financial_capacity_assessments("opportunityId", "confirmedAt");
CREATE TRIGGER trg_financial_capacity_assessments_append_only
BEFORE UPDATE OR DELETE ON financial_capacity_assessments
FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();

CREATE TABLE customer_payment_assessments(
  id uuid PRIMARY KEY,
  "customerId" uuid REFERENCES customers(id),
  "authorityId" uuid REFERENCES contracting_authorities(id),
  "subjectKey" varchar(200) NOT NULL,
  version integer NOT NULL CHECK(version > 0),
  "periodStart" date NOT NULL,
  "periodEnd" date NOT NULL,
  classification "PaymentRiskClassification" NOT NULL,
  "authorizedMetrics" jsonb NOT NULL,
  justification text NOT NULL,
  evidence jsonb NOT NULL,
  "assessmentHash" char(64) NOT NULL CHECK("assessmentHash" ~ '^[0-9a-f]{64}$'),
  "confirmedAt" timestamptz NOT NULL,
  "confirmedBy" uuid NOT NULL REFERENCES users(id),
  "correlationId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK(("customerId" IS NOT NULL) <> ("authorityId" IS NOT NULL)),
  CHECK("periodEnd" >= "periodStart"),
  UNIQUE("subjectKey", version),
  UNIQUE("subjectKey", "assessmentHash")
);
CREATE INDEX customer_payment_assessments_customer_idx
  ON customer_payment_assessments("customerId", "confirmedAt");
CREATE INDEX customer_payment_assessments_authority_idx
  ON customer_payment_assessments("authorityId", "confirmedAt");
CREATE TRIGGER trg_customer_payment_assessments_append_only
BEFORE UPDATE OR DELETE ON customer_payment_assessments
FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();

CREATE TABLE opportunity_financial_studies(
  id uuid PRIMARY KEY,
  "analysisId" uuid NOT NULL UNIQUE REFERENCES opportunity_analyses(id),
  "financialAssessmentId" uuid REFERENCES financial_capacity_assessments(id),
  "paymentAssessmentId" uuid REFERENCES customer_payment_assessments(id),
  "highIndebtednessRisk" boolean NOT NULL,
  "nonPayingCustomer" boolean NOT NULL,
  summary text NOT NULL,
  "evidenceSnapshot" jsonb NOT NULL,
  "resultHash" char(64) NOT NULL CHECK("resultHash" ~ '^[0-9a-f]{64}$'),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX opportunity_financial_studies_financial_idx
  ON opportunity_financial_studies("financialAssessmentId");
CREATE INDEX opportunity_financial_studies_payment_idx
  ON opportunity_financial_studies("paymentAssessmentId");
CREATE TRIGGER trg_opportunity_financial_studies_append_only
BEFORE UPDATE OR DELETE ON opportunity_financial_studies
FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();

INSERT INTO permissions(id,code,module,action,description,"createdAt","createdBy") VALUES
('e5900000-0000-4000-8000-000000000010','analytics.assess-financial','analytics','assess-financial','Registrar avaliação formal de capacidade financeira.',now(),'00000000-0000-0000-0000-000000000000'),
('e5900000-0000-4000-8000-000000000011','analytics.assess-client-risk','analytics','assess-client-risk','Registrar classificação formal do risco de pagamento do cliente.',now(),'00000000-0000-0000-0000-000000000000');

INSERT INTO profile_permissions("profileId","permissionId","grantedAt","grantedBy")
SELECT 'a2100000-0000-4000-8000-000000000001',id,now(),'00000000-0000-0000-0000-000000000000'
FROM permissions
WHERE code IN('analytics.assess-financial','analytics.assess-client-risk');
