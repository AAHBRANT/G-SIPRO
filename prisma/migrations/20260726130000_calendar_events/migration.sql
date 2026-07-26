CREATE TYPE "CalendarEventStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

CREATE TABLE "calendar_events" (
  "id" uuid PRIMARY KEY,
  "title" varchar(200) NOT NULL,
  "description" varchar(2000),
  "startAt" timestamptz(6) NOT NULL,
  "endAt" timestamptz(6),
  "allDay" boolean NOT NULL DEFAULT false,
  "responsibleId" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "opportunityId" uuid REFERENCES "opportunities"("id") ON DELETE RESTRICT,
  "proposalId" uuid REFERENCES "proposals"("id") ON DELETE RESTRICT,
  "tenderId" uuid REFERENCES "tenders"("id") ON DELETE RESTRICT,
  "status" "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED',
  "externalId" varchar(200),
  "externalSource" varchar(40),
  "version" integer NOT NULL DEFAULT 1,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "createdBy" uuid NOT NULL,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedBy" uuid NOT NULL,
  CONSTRAINT "calendar_events_end_after_start" CHECK ("endAt" IS NULL OR "endAt" >= "startAt"),
  CONSTRAINT "calendar_events_single_link" CHECK (
    (CASE WHEN "opportunityId" IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN "proposalId" IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN "tenderId" IS NOT NULL THEN 1 ELSE 0 END) <= 1
  )
);

CREATE INDEX "calendar_events_responsibleId_startAt_idx" ON "calendar_events" ("responsibleId", "startAt");
CREATE INDEX "calendar_events_startAt_idx" ON "calendar_events" ("startAt");
CREATE INDEX "calendar_events_opportunityId_idx" ON "calendar_events" ("opportunityId");
