CREATE TABLE "calendar_event_participants" (
  "id" uuid PRIMARY KEY,
  "calendarEventId" uuid NOT NULL REFERENCES "calendar_events"("id") ON DELETE RESTRICT,
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  UNIQUE ("calendarEventId", "userId")
);

CREATE INDEX "calendar_event_participants_userId_idx" ON "calendar_event_participants" ("userId");
