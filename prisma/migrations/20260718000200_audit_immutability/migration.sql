-- Eventos de auditoria são append-only para a aplicação.
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_event_mutation();

COMMENT ON TABLE "audit_events" IS
'GSIPRO-TEC-205: eventos imutáveis; somente INSERT é permitido no fluxo da aplicação.';
