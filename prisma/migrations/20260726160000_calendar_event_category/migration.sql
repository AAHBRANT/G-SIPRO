CREATE TYPE "CalendarEventCategory" AS ENUM ('MEETING', 'TRAVEL', 'INTERNAL_DEADLINE', 'PERSONAL', 'OTHER');

ALTER TABLE "calendar_events"
  ADD COLUMN "category" "CalendarEventCategory" NOT NULL DEFAULT 'MEETING';
