CREATE TABLE "notification_settings" (
  "id" uuid PRIMARY KEY,
  "emailSender" varchar(320),
  "version" integer NOT NULL DEFAULT 1,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(6) NOT NULL,
  "updatedBy" uuid NOT NULL
);
