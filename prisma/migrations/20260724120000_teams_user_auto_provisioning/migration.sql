CREATE TYPE "TeamsProvisioningStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING', 'INSTALLED', 'FAILED');

ALTER TABLE "users"
  ADD COLUMN "teamsProvisioningStatus" "TeamsProvisioningStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN "teamsProvisioningAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "teamsProvisioningLastAttemptAt" TIMESTAMPTZ(6),
  ADD COLUMN "teamsProvisionedAt" TIMESTAMPTZ(6),
  ADD COLUMN "teamsProvisioningErrorCode" VARCHAR(80);

ALTER TABLE "users"
  ALTER COLUMN "teamsProvisioningStatus" SET DEFAULT 'PENDING';

CREATE INDEX "users_teamsProvisioningStatus_status_idx"
  ON "users"("teamsProvisioningStatus", "status");
