CREATE TYPE "AttractivenessCategory" AS ENUM ('QUALITATIVE', 'QUANTITATIVE');

CREATE TABLE "attractiveness_points" (
  "id" uuid PRIMARY KEY,
  "opportunityId" uuid NOT NULL REFERENCES "opportunities"("id") ON DELETE RESTRICT,
  "category" "AttractivenessCategory" NOT NULL,
  "description" varchar(1000) NOT NULL,
  "amount" numeric(14, 2),
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "createdBy" uuid NOT NULL
);

CREATE INDEX "attractiveness_points_opportunityId_createdAt_idx" ON "attractiveness_points" ("opportunityId", "createdAt");
