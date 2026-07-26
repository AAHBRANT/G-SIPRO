CREATE TABLE climate_studies(
  id uuid PRIMARY KEY,
  "analysisId" uuid NOT NULL UNIQUE REFERENCES opportunity_analyses(id),
  provider varchar(120) NOT NULL,
  "providerRequestId" varchar(160),
  "locationLabel" varchar(255) NOT NULL,
  latitude numeric(10,7) NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude numeric(10,7) NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  "workStart" date NOT NULL,
  "workEnd" date NOT NULL,
  "historyStart" date NOT NULL,
  "historyEnd" date NOT NULL,
  station jsonb,
  "monthlySeries" jsonb NOT NULL,
  "sourceMetadata" jsonb NOT NULL,
  "dataCoverage" numeric(7,4) NOT NULL CHECK("dataCoverage" BETWEEN 0 AND 100),
  "responseHash" char(64) NOT NULL CHECK("responseHash" ~ '^[0-9a-f]{64}$'),
  "retrievedAt" timestamptz NOT NULL,
  "methodVersion" varchar(80) NOT NULL,
  "resultHash" char(64) NOT NULL CHECK("resultHash" ~ '^[0-9a-f]{64}$'),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK("workEnd">="workStart"),
  CHECK("historyEnd">="historyStart")
);

CREATE INDEX climate_studies_provider_idx ON climate_studies(provider,"retrievedAt");
CREATE INDEX climate_studies_location_idx ON climate_studies(latitude,longitude);
CREATE TRIGGER trg_climate_studies_append_only
BEFORE UPDATE OR DELETE ON climate_studies
FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
