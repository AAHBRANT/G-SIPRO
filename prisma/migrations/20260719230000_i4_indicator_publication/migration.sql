CREATE TABLE indicator_publications(
  id uuid PRIMARY KEY,"reconciliationId" uuid NOT NULL UNIQUE REFERENCES indicator_reconciliations(id),"snapshotId" uuid NOT NULL UNIQUE REFERENCES indicator_snapshots(id),
  "qualityState" "IndicatorReconciliationStatus" NOT NULL,"dataUpdatedAt" timestamptz NOT NULL,"lineageHash" char(64) NOT NULL CHECK("lineageHash"~'^[a-f0-9]{64}$'),
  note varchar(1000) NOT NULL,"publishedAt" timestamptz NOT NULL,"publishedBy" uuid NOT NULL REFERENCES users(id),"correlationId" uuid NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX indicator_publications_published_idx ON indicator_publications("publishedAt");CREATE INDEX indicator_publications_quality_updated_idx ON indicator_publications("qualityState","dataUpdatedAt");
CREATE FUNCTION gsipro_validate_indicator_publication() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reconciliation indicator_reconciliations;observed indicator_snapshots;definition indicator_definitions;
BEGIN
  SELECT * INTO reconciliation FROM indicator_reconciliations WHERE id=NEW."reconciliationId";SELECT * INTO observed FROM indicator_snapshots WHERE id=NEW."snapshotId";
  IF reconciliation.id IS NULL OR reconciliation.status<>'MATCH' OR NEW."qualityState"<>'MATCH' OR reconciliation."observedSnapshotId"<>NEW."snapshotId" THEN RAISE EXCEPTION 'Publicação exige a observação de uma conciliação exata.' USING ERRCODE='check_violation';END IF;
  IF NEW."dataUpdatedAt"<>observed."calculatedAt" THEN RAISE EXCEPTION 'A atualização publicada deve corresponder ao snapshot observado.' USING ERRCODE='check_violation';END IF;
  SELECT * INTO definition FROM indicator_definitions WHERE id=observed."definitionId";
  IF NOT EXISTS(SELECT 1 FROM indicator_approvals WHERE "definitionId"=definition.id) OR EXISTS(SELECT 1 FROM indicator_definitions later JOIN indicator_approvals approval ON approval."definitionId"=later.id WHERE later."indicatorKey"=definition."indicatorKey" AND later.version>definition.version) THEN RAISE EXCEPTION 'Publicação exige definição aprovada mais recente.' USING ERRCODE='check_violation';END IF;
  IF EXISTS(SELECT 1 FROM indicator_reconciliations later WHERE later."baselineSnapshotId"=reconciliation."baselineSnapshotId" AND later."checkedAt">reconciliation."checkedAt") THEN RAISE EXCEPTION 'Publicação exige a conciliação mais recente do snapshot.' USING ERRCODE='check_violation';END IF;RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_indicator_publication BEFORE INSERT ON indicator_publications FOR EACH ROW EXECUTE FUNCTION gsipro_validate_indicator_publication();CREATE TRIGGER trg_indicator_publications_append_only BEFORE UPDATE OR DELETE ON indicator_publications FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();
INSERT INTO permissions(id,code,module,action,description,"createdAt","createdBy") VALUES('e4800000-0000-4000-8000-000000000001','indicators.publish','indicators','publish','Publicar indicador conciliado com atualização, qualidade e linhagem.',now(),'00000000-0000-0000-0000-000000000000');INSERT INTO profile_permissions("profileId","permissionId","grantedAt","grantedBy") VALUES('a2100000-0000-4000-8000-000000000001','e4800000-0000-4000-8000-000000000001',now(),'00000000-0000-0000-0000-000000000000');
