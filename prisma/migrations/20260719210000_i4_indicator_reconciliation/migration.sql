CREATE TYPE "IndicatorReconciliationStatus" AS ENUM('MATCH','DIVERGENT');

DO $$ DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name FROM pg_constraint
  WHERE conrelid='indicator_snapshots'::regclass AND contype='u'
    AND pg_get_constraintdef(oid) LIKE '%"definitionId"%'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN EXECUTE format('ALTER TABLE indicator_snapshots DROP CONSTRAINT %I',constraint_name); END IF;
END $$;
ALTER TABLE indicator_snapshots ADD CONSTRAINT indicator_snapshots_execution_key UNIQUE("definitionId","periodStart","periodEnd",currency,"payloadHash","calculatedAt");

CREATE TABLE indicator_reconciliations(
  id uuid PRIMARY KEY,
  "baselineSnapshotId" uuid NOT NULL REFERENCES indicator_snapshots(id),
  "observedSnapshotId" uuid NOT NULL UNIQUE REFERENCES indicator_snapshots(id),
  status "IndicatorReconciliationStatus" NOT NULL,
  "numeratorDifference" numeric(24,8) NOT NULL,
  "denominatorDifference" numeric(24,8),
  "valueDifference" numeric(24,8) NOT NULL,
  "sourceCountDifference" integer NOT NULL,
  "checkedAt" timestamptz NOT NULL,
  "checkedBy" uuid NOT NULL REFERENCES users(id),
  note varchar(1000) NOT NULL,
  "correlationId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CHECK("baselineSnapshotId"<>"observedSnapshotId")
);
CREATE INDEX indicator_reconciliations_baseline_checked_idx ON indicator_reconciliations("baselineSnapshotId","checkedAt");
CREATE INDEX indicator_reconciliations_status_checked_idx ON indicator_reconciliations(status,"checkedAt");

CREATE FUNCTION gsipro_validate_indicator_reconciliation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE baseline indicator_snapshots; observed indicator_snapshots; expected_status "IndicatorReconciliationStatus";
BEGIN
  SELECT * INTO baseline FROM indicator_snapshots WHERE id=NEW."baselineSnapshotId";
  SELECT * INTO observed FROM indicator_snapshots WHERE id=NEW."observedSnapshotId";
  IF baseline.id IS NULL OR observed.id IS NULL OR baseline."definitionId"<>observed."definitionId" OR baseline."calculationMethod"<>observed."calculationMethod"
    OR baseline."periodStart"<>observed."periodStart" OR baseline."periodEnd"<>observed."periodEnd" OR baseline.currency IS DISTINCT FROM observed.currency
    OR observed."calculatedAt"<baseline."calculatedAt" THEN RAISE EXCEPTION 'Conciliação exige snapshots comparáveis e uma observação posterior.' USING ERRCODE='check_violation'; END IF;
  IF NEW."numeratorDifference"<>observed.numerator-baseline.numerator
    OR NEW."denominatorDifference" IS DISTINCT FROM (CASE WHEN observed.denominator IS NULL AND baseline.denominator IS NULL THEN NULL ELSE COALESCE(observed.denominator,0)-COALESCE(baseline.denominator,0) END)
    OR NEW."valueDifference"<>observed.value-baseline.value
    OR NEW."sourceCountDifference"<>observed."sourceRecordCount"-baseline."sourceRecordCount" THEN RAISE EXCEPTION 'Diferenças da conciliação não correspondem aos snapshots.' USING ERRCODE='check_violation'; END IF;
  expected_status:=CASE WHEN baseline.numerator=observed.numerator AND baseline.denominator IS NOT DISTINCT FROM observed.denominator AND baseline.value=observed.value AND baseline."sourceRecordCount"=observed."sourceRecordCount" AND baseline."payloadHash"=observed."payloadHash" THEN 'MATCH' ELSE 'DIVERGENT' END;
  IF NEW.status<>expected_status THEN RAISE EXCEPTION 'Estado da conciliação não corresponde à comparação exata.' USING ERRCODE='check_violation'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_indicator_reconciliation BEFORE INSERT ON indicator_reconciliations FOR EACH ROW EXECUTE FUNCTION gsipro_validate_indicator_reconciliation();
CREATE TRIGGER trg_indicator_reconciliations_append_only BEFORE UPDATE OR DELETE ON indicator_reconciliations FOR EACH ROW EXECUTE FUNCTION gsipro_competition_append_only();

INSERT INTO permissions(id,code,module,action,description,"createdAt","createdBy") VALUES('e4600000-0000-4000-8000-000000000001','indicators.reconcile','indicators','reconcile','Conciliar snapshot analítico com recálculo operacional independente.',now(),'00000000-0000-0000-0000-000000000000');
INSERT INTO profile_permissions("profileId","permissionId","grantedAt","grantedBy") VALUES('a2100000-0000-4000-8000-000000000001','e4600000-0000-4000-8000-000000000001',now(),'00000000-0000-0000-0000-000000000000');
