-- Leitura de edital sem IA (edital-text-requirement.ts).
--
-- "scouted_tender_edital_readings"."executionId" era obrigatório: toda leitura
-- gravada precisava vir de uma execução de IA (ai_extraction_executions). Isso
-- deixava o leitor por casamento de padrão contra o TEXTO do edital — já
-- validado contra 3 editais reais (Pedra Preta/MT, Santa Cruz do Sul/RS,
-- Camaquá/RS) — sem nenhum caminho de gravação: gravar exigia referenciar uma
-- execução que nunca aconteceu.
--
-- "readMethod" existe porque "executionId" nulo sozinho é ambíguo: não dava
-- para distinguir "a leitura não usou IA de propósito" (PATTERN_MATCH) de um
-- estado inconsistente. A CHECK abaixo amarra os dois: AI sempre com
-- execução, PATTERN_MATCH nunca com execução — nunca os dois juntos, nunca
-- nenhum dos dois.
--
-- "readById" continua obrigatório: mesmo quando a leitura cai para o modo sem
-- IA, ela ainda acontece dentro da mesma requisição autenticada
-- (POST .../edital, que exige `ai.execute`) — sempre há uma pessoa por trás.
-- Não há aqui nenhum caminho de disparo automático sem sessão de usuário.

CREATE TYPE "EditalReadMethod" AS ENUM ('AI', 'PATTERN_MATCH');

ALTER TABLE "scouted_tender_edital_readings"
  ADD COLUMN "readMethod" "EditalReadMethod" NOT NULL DEFAULT 'AI';

-- Toda linha já gravada veio da Central IA: o default cobre o histórico sem
-- precisar de UPDATE em massa.

ALTER TABLE "scouted_tender_edital_readings"
  ALTER COLUMN "executionId" DROP NOT NULL;

ALTER TABLE "scouted_tender_edital_readings"
  ADD CONSTRAINT "scouted_tender_edital_readings_method_execution"
  CHECK (
    ("readMethod" = 'AI' AND "executionId" IS NOT NULL)
    OR
    ("readMethod" = 'PATTERN_MATCH' AND "executionId" IS NULL)
  );
