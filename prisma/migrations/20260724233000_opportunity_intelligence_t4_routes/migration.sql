CREATE TABLE operational_bases(
  id uuid PRIMARY KEY,
  code varchar(50) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  locality varchar(200) NOT NULL,
  latitude numeric(10,7) NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude numeric(10,7) NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  source varchar(500) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "createdBy" uuid NOT NULL REFERENCES users(id),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "updatedBy" uuid NOT NULL REFERENCES users(id)
);
CREATE INDEX operational_bases_active_idx ON operational_bases(active,name);

CREATE TABLE route_studies(
  id uuid PRIMARY KEY,
  "analysisId" uuid NOT NULL UNIQUE REFERENCES opportunity_analyses(id),
  provider varchar(120) NOT NULL,
  "providerRequestId" varchar(160),
  "destinationLabel" varchar(255) NOT NULL,
  "destinationLat" numeric(10,7) NOT NULL CHECK("destinationLat" BETWEEN -90 AND 90),
  "destinationLng" numeric(10,7) NOT NULL CHECK("destinationLng" BETWEEN -180 AND 180),
  "travelMode" varchar(40) NOT NULL,
  alternatives jsonb NOT NULL,
  "selectedBaseId" uuid REFERENCES operational_bases(id),
  "selectionStatus" varchar(40) NOT NULL,
  "requestHash" char(64) NOT NULL CHECK("requestHash" ~ '^[0-9a-f]{64}$'),
  "responseHash" char(64) NOT NULL CHECK("responseHash" ~ '^[0-9a-f]{64}$'),
  "retrievedAt" timestamptz NOT NULL,
  "methodVersion" varchar(80) NOT NULL,
  "resultHash" char(64) NOT NULL CHECK("resultHash" ~ '^[0-9a-f]{64}$'),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX route_studies_provider_idx ON route_studies(provider,"retrievedAt");
CREATE INDEX route_studies_selected_base_idx ON route_studies("selectedBaseId");
CREATE TRIGGER trg_route_studies_append_only
BEFORE UPDATE OR DELETE ON route_studies
FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();

CREATE TABLE route_detail_studies(
  id uuid PRIMARY KEY,
  "routeStudyId" uuid NOT NULL REFERENCES route_studies(id),
  "baseId" uuid NOT NULL REFERENCES operational_bases(id),
  provider varchar(120) NOT NULL,
  "distanceMeters" integer NOT NULL CHECK("distanceMeters">=0),
  "durationSeconds" numeric(12,3) NOT NULL CHECK("durationSeconds">=0),
  "encodedPolyline" text NOT NULL,
  tolls jsonb NOT NULL,
  "responseHash" char(64) NOT NULL CHECK("responseHash" ~ '^[0-9a-f]{64}$'),
  "retrievedAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("routeStudyId","baseId","responseHash")
);
CREATE INDEX route_detail_studies_lookup_idx ON route_detail_studies("routeStudyId","baseId","retrievedAt");
CREATE TRIGGER trg_route_detail_studies_append_only
BEFORE UPDATE OR DELETE ON route_detail_studies
FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
