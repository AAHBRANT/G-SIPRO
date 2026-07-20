DROP TRIGGER IF EXISTS trg_competition_acts_append_only ON competition_acts;
DROP TRIGGER IF EXISTS trg_validate_competition_act ON competition_acts;
DROP FUNCTION IF EXISTS gsipro_validate_competition_act();
DROP TABLE IF EXISTS competition_acts;
DROP TYPE IF EXISTS "CompetitionActType";
