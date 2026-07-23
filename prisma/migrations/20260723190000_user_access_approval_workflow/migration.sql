CREATE TYPE "UserAccessRequestAction" AS ENUM ('CREATE', 'UPDATE');
CREATE TYPE "UserAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "user_access_requests" (
  "id" UUID NOT NULL,
  "action" "UserAccessRequestAction" NOT NULL,
  "status" "UserAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" UUID NOT NULL,
  "targetUserId" UUID,
  "payload" JSONB NOT NULL,
  "decisionNote" VARCHAR(1000),
  "decidedById" UUID,
  "decidedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_access_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_access_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "user_access_requests_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "user_access_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "user_access_requests_status_createdAt_idx" ON "user_access_requests"("status", "createdAt");
CREATE INDEX "user_access_requests_requestedById_createdAt_idx" ON "user_access_requests"("requestedById", "createdAt");
CREATE INDEX "user_access_requests_targetUserId_idx" ON "user_access_requests"("targetUserId");
