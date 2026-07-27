CREATE TABLE "calendar_event_attendees" (
  "calendarEventId" uuid NOT NULL REFERENCES "calendar_events"("id") ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "calendar_event_attendees_pkey" PRIMARY KEY ("calendarEventId", "userId")
);

CREATE INDEX "calendar_event_attendees_userId_idx" ON "calendar_event_attendees" ("userId");
