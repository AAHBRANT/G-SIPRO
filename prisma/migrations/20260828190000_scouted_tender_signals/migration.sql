-- Buscador G-SIPRO: sinalização da fila de triagem.
--
-- A equipe finca uma marca colorida na licitação para dizer o que fazer com
-- ela. Três níveis fixos em semáforo e um nível livre, em que a pessoa escreve
-- o próprio nome e escolhe a própria cor.

CREATE TYPE "ScoutSignalLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'CUSTOM');

CREATE TABLE "scouted_tender_signals" (
    "id" UUID NOT NULL,
    "tenderId" UUID NOT NULL,
    "level" "ScoutSignalLevel" NOT NULL,
    "label" VARCHAR(34) NOT NULL,
    -- Cor escolhida, em #RRGGBB. As variantes clara e escura não são gravadas:
    -- derivam desta a cada leitura, para acompanharem melhorias na regra de
    -- contraste sem precisar reescrever o que já está gravado.
    "color" CHAR(7) NOT NULL,
    "note" VARCHAR(400),
    "signaledById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scouted_tender_signals_pkey" PRIMARY KEY ("id")
);

-- Uma sinalização por licitação, não por pessoa: a marca orienta quem abrir a
-- fila depois, e duas marcas concorrentes na mesma linha só confundiriam.
CREATE UNIQUE INDEX "scouted_tender_signals_tenderId_key" ON "scouted_tender_signals"("tenderId");
CREATE INDEX "scouted_tender_signals_signaledById_idx" ON "scouted_tender_signals"("signaledById");

-- A sinalização não sobrevive à licitação que ela marca.
ALTER TABLE "scouted_tender_signals"
    ADD CONSTRAINT "scouted_tender_signals_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "scouted_tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quem sinalizou fica registrado e não pode ser apagado deixando a marca órfã.
ALTER TABLE "scouted_tender_signals"
    ADD CONSTRAINT "scouted_tender_signals_signaledById_fkey"
    FOREIGN KEY ("signaledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
