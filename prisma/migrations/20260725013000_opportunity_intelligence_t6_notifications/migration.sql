CREATE TYPE "IntelligenceNotificationType" AS ENUM(
  'ANALYSIS_COMPLETED',
  'RECOMMENDATION_CHANGED',
  'INFORMATION_REQUESTED',
  'IMPEDIMENT_DETECTED',
  'OWNER_DECISION_REQUIRED',
  'DECISION_RECORDED'
);
CREATE TYPE "NotificationOutboxStatus" AS ENUM(
  'PENDING',
  'PROCESSING',
  'RETRY',
  'SENT',
  'PARTIAL',
  'FAILED'
);
CREATE TYPE "NotificationChannel" AS ENUM('PANEL','TEAMS','EMAIL');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM('PENDING','ACCEPTED','SKIPPED','RETRY','FAILED');

CREATE TABLE notification_outbox_events(
  id uuid PRIMARY KEY,
  "eventKey" varchar(200) NOT NULL UNIQUE,
  type "IntelligenceNotificationType" NOT NULL,
  "opportunityId" uuid NOT NULL REFERENCES opportunities(id),
  "analysisId" uuid REFERENCES opportunity_analyses(id),
  "recipientId" uuid NOT NULL REFERENCES users(id),
  summary varchar(500) NOT NULL,
  "nextAction" varchar(500) NOT NULL,
  "deepLink" varchar(500) NOT NULL,
  payload jsonb NOT NULL,
  status "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  "availableAt" timestamptz NOT NULL DEFAULT now(),
  "leaseId" uuid UNIQUE,
  "leasedAt" timestamptz,
  "lastErrorCode" varchar(120),
  "sentAt" timestamptz,
  "correlationId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_outbox_events_dispatch_idx ON notification_outbox_events(status,"availableAt");
CREATE INDEX notification_outbox_events_recipient_idx ON notification_outbox_events("recipientId","createdAt");
CREATE INDEX notification_outbox_events_opportunity_idx ON notification_outbox_events("opportunityId","createdAt");

CREATE TABLE user_notifications(
  id uuid PRIMARY KEY,
  "outboxEventId" uuid NOT NULL UNIQUE REFERENCES notification_outbox_events(id),
  "recipientId" uuid NOT NULL REFERENCES users(id),
  type "IntelligenceNotificationType" NOT NULL,
  summary varchar(500) NOT NULL,
  "nextAction" varchar(500) NOT NULL,
  "deepLink" varchar(500) NOT NULL,
  "readAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_notifications_inbox_idx ON user_notifications("recipientId","readAt","createdAt");

CREATE TABLE notification_deliveries(
  id uuid PRIMARY KEY,
  "outboxEventId" uuid NOT NULL REFERENCES notification_outbox_events(id),
  channel "NotificationChannel" NOT NULL,
  status "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  "providerReference" varchar(200),
  "acceptedAt" timestamptz,
  "attemptedAt" timestamptz,
  "errorCode" varchar(120),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("outboxEventId",channel)
);
CREATE INDEX notification_deliveries_status_idx ON notification_deliveries(status,"attemptedAt");

INSERT INTO permissions(id,code,module,action,description,"createdAt","createdBy") VALUES
('e5900000-0000-4000-8000-000000000012','notifications.read','notifications','read','Consultar e marcar notificações próprias como lidas.',now(),'00000000-0000-0000-0000-000000000000');
INSERT INTO profile_permissions("profileId","permissionId","grantedAt","grantedBy")
SELECT profile.id,permission.id,now(),'00000000-0000-0000-0000-000000000000'
FROM profiles profile
CROSS JOIN permissions permission
WHERE profile.active=true AND permission.code='notifications.read'
ON CONFLICT("profileId","permissionId") DO NOTHING;
