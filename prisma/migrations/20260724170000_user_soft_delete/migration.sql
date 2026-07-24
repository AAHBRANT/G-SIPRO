ALTER TABLE "users"
ADD COLUMN "archivedAt" TIMESTAMPTZ(6),
ADD COLUMN "archivedBy" UUID;

CREATE INDEX "users_archivedAt_idx" ON "users"("archivedAt");
