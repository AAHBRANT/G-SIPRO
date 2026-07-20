DROP TRIGGER IF EXISTS audit_events_append_only ON "audit_events";
DROP FUNCTION IF EXISTS prevent_audit_event_mutation();
