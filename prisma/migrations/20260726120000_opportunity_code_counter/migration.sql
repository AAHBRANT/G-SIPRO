CREATE TABLE "opportunity_code_counters" (
  "year" integer PRIMARY KEY,
  "lastNumber" integer NOT NULL CHECK ("lastNumber" >= 0),
  "updatedAt" timestamptz(6) NOT NULL DEFAULT now()
);

-- Semente 2026: continua a contagem a partir das 9 oportunidades já
-- cadastradas manualmente (PPB_001..PPB_009) antes da numeração automática
-- existir. A próxima oportunidade criada recebe PPB-010-26.
INSERT INTO "opportunity_code_counters" ("year", "lastNumber") VALUES (2026, 9);
