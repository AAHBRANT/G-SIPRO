-- Buscador G-SIPRO: guarda o tipo de obra reconhecido na varredura, para que a
-- fila de triagem possa ser filtrada por ramo sem reinterpretar o objeto.
ALTER TABLE "scouted_tenders" ADD COLUMN "workTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- As licitações já captadas ficam sem classificação até a próxima varredura;
-- o filtro por tipo simplesmente não as alcança, sem quebrar a listagem.
UPDATE "scouted_tenders" SET "workTypes" = ARRAY[]::TEXT[] WHERE "workTypes" IS NULL;
ALTER TABLE "scouted_tenders" ALTER COLUMN "workTypes" SET NOT NULL;
