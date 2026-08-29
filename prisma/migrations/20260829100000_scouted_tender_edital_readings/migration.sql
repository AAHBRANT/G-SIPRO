-- Buscador G-SIPRO: o que a leitura do edital extraiu de qualificação técnica.
--
-- A lista de pré-requisitos da fila de triagem responde hoje só o que o próprio
-- sistema apura (acervo, porte, prazo, valor). Consórcio, CAT, visita técnica e
-- garantia estão no edital, e sem lê-lo a tela tem de dizer "a conferir". Esta
-- tabela guarda o resultado da leitura para que a resposta apareça — e para que
-- o mesmo edital não seja lido duas vezes, que é chamada de IA paga.
--
-- O ARQUIVO NÃO É PRESERVADO. São ~453 editais de ~12 MB por varredura, perto
-- de 5 GB de PDF público que o PNCP já guarda. O que fica é o endereço de onde
-- os bytes vieram — que é também o link de download que a fila oferece — mais
-- o SHA-256 do que foi lido e a data da captura. É o mesmo desenho de
-- climate_studies e analysis_evidences, já em produção neste banco.

CREATE TABLE "scouted_tender_edital_readings" (
    "id" UUID NOT NULL,
    "tenderId" UUID NOT NULL,
    -- Execução de IA que produziu esta leitura. É por ela que se chega ao
    -- modelo, à versão do prompt e aos trechos citados — o rastro que antes
    -- passava pelo arquivo guardado.
    "executionId" UUID NOT NULL,
    -- Endereço público do arquivo lido, no PNCP. A fila oferece este link para
    -- a pessoa baixar o edital sem navegar o portal.
    "sourceUri" VARCHAR(1000) NOT NULL,
    "sourceFilename" VARCHAR(255) NOT NULL,
    -- SHA-256 dos bytes efetivamente enviados ao modelo. Sem arquivo guardado,
    -- é o que denuncia edital retificado depois da leitura.
    "sourceFileHash" CHAR(64) NOT NULL,
    "sourceFetchedAt" TIMESTAMPTZ(6) NOT NULL,
    -- Parcelas de maior relevância com os quantitativos mínimos, como a leitura
    -- as devolveu. JSON porque a forma varia com o edital: uns exigem metro
    -- linear de ponte, outros metro cúbico de concreto, outros só descrevem.
    "services" JSONB NOT NULL,
    -- Nulo quer dizer "a leitura não achou", que é diferente de "o edital veda".
    "consortiumAllowed" BOOLEAN,
    "requiresCat" BOOLEAN,
    "requiresSiteVisit" BOOLEAN,
    "confidence" DECIMAL(5,4),
    -- O que a leitura declarou não ter conseguido determinar. Aparece na tela:
    -- lacuna escondida vira pré-requisito silenciosamente não verificado.
    "limitations" JSONB NOT NULL,
    "readById" UUID NOT NULL,
    -- Enquanto for nulo, a leitura é ASSISTIVA: a tela mostra o que ela achou
    -- com a ressalva de que ninguém conferiu. Parcela lida errado manda a
    -- equipe montar consórcio de que não precisa, ou disputar sozinha o que
    -- não pode.
    "reviewedAt" TIMESTAMPTZ(6),
    "reviewedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scouted_tender_edital_readings_pkey" PRIMARY KEY ("id")
);

-- Uma leitura por licitação: reler substitui a anterior.
CREATE UNIQUE INDEX "scouted_tender_edital_readings_tenderId_key"
    ON "scouted_tender_edital_readings"("tenderId");
CREATE INDEX "scouted_tender_edital_readings_readById_idx"
    ON "scouted_tender_edital_readings"("readById");
CREATE INDEX "scouted_tender_edital_readings_executionId_idx"
    ON "scouted_tender_edital_readings"("executionId");

-- A leitura não sobrevive à licitação que ela descreve.
ALTER TABLE "scouted_tender_edital_readings"
    ADD CONSTRAINT "scouted_tender_edital_readings_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "scouted_tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A execução que a produziu é imutável e não pode sumir por baixo da leitura.
ALTER TABLE "scouted_tender_edital_readings"
    ADD CONSTRAINT "scouted_tender_edital_readings_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "ai_extraction_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "scouted_tender_edital_readings"
    ADD CONSTRAINT "scouted_tender_edital_readings_readById_fkey"
    FOREIGN KEY ("readById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "scouted_tender_edital_readings"
    ADD CONSTRAINT "scouted_tender_edital_readings_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Conferido tem de ter conferente: os dois campos andam juntos ou nenhum.
ALTER TABLE "scouted_tender_edital_readings"
    ADD CONSTRAINT "scouted_tender_edital_readings_review_complete"
    CHECK (("reviewedAt" IS NULL) = ("reviewedById" IS NULL));

-- Hash malformado passaria despercebido e só apareceria na hora de conferir.
ALTER TABLE "scouted_tender_edital_readings"
    ADD CONSTRAINT "scouted_tender_edital_readings_hash_sha256"
    CHECK ("sourceFileHash" ~ '^[a-f0-9]{64}$');
