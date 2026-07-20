CREATE OR REPLACE FUNCTION gsipro_guard_submitted_technical_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_component uuid;
  target_section uuid;
  submitted boolean;
BEGIN
  IF TG_TABLE_NAME = 'proposal_technical_sections' THEN
    IF TG_OP = 'DELETE' THEN target_component := OLD."componentId"; ELSE target_component := NEW."componentId"; END IF;
    SELECT EXISTS (
      SELECT 1 FROM proposal_components pc
      JOIN proposal_submissions ps ON ps."proposalVersionId" = pc."proposalVersionId"
      WHERE pc.id = target_component
    ) INTO submitted;
  ELSE
    IF TG_OP = 'DELETE' THEN target_section := OLD."sectionId"; ELSE target_section := NEW."sectionId"; END IF;
    SELECT EXISTS (
      SELECT 1 FROM proposal_technical_sections pts
      JOIN proposal_components pc ON pc.id = pts."componentId"
      JOIN proposal_submissions ps ON ps."proposalVersionId" = pc."proposalVersionId"
      WHERE pts.id = target_section
    ) INTO submitted;
  END IF;

  IF submitted THEN
    RAISE EXCEPTION 'A versão técnica enviada está congelada; crie uma nova versão da proposta.' USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER trg_freeze_submitted_technical_sections BEFORE INSERT OR UPDATE OR DELETE ON proposal_technical_sections FOR EACH ROW EXECUTE FUNCTION gsipro_guard_submitted_technical_version();
CREATE TRIGGER trg_freeze_submitted_technical_requirements BEFORE INSERT OR UPDATE OR DELETE ON proposal_technical_section_requirements FOR EACH ROW EXECUTE FUNCTION gsipro_guard_submitted_technical_version();
CREATE TRIGGER trg_freeze_submitted_technical_content BEFORE INSERT OR UPDATE OR DELETE ON proposal_technical_content_versions FOR EACH ROW EXECUTE FUNCTION gsipro_guard_submitted_technical_version();
CREATE TRIGGER trg_freeze_submitted_technical_evidence BEFORE INSERT OR UPDATE OR DELETE ON proposal_technical_evidence_links FOR EACH ROW EXECUTE FUNCTION gsipro_guard_submitted_technical_version();
CREATE TRIGGER trg_freeze_submitted_technical_comments BEFORE INSERT OR UPDATE OR DELETE ON proposal_technical_review_comments FOR EACH ROW EXECUTE FUNCTION gsipro_guard_submitted_technical_version();
CREATE TRIGGER trg_freeze_submitted_technical_reviews BEFORE INSERT OR UPDATE OR DELETE ON proposal_technical_reviews FOR EACH ROW EXECUTE FUNCTION gsipro_guard_submitted_technical_version();
CREATE TRIGGER trg_freeze_submitted_technical_history BEFORE INSERT OR UPDATE OR DELETE ON proposal_technical_section_history FOR EACH ROW EXECUTE FUNCTION gsipro_guard_submitted_technical_version();
