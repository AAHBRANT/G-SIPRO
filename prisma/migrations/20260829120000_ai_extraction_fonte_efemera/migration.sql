-- Extração de IA sobre fonte efêmera.
--
-- Até aqui toda execução exigia arquivo no acervo. Para o edital isso não se
-- sustenta: são ~453 arquivos de ~12 MB por varredura, perto de 5 GB de PDF
-- público que o PNCP já guarda e oferece por URL direta. O sistema precisa LER
-- o edital, não guardá-lo.
--
-- A execução passa a admitir DUAS procedências, exatamente uma por linha:
--   "documentVersionId" — arquivo preservado no acervo (o que já existia);
--   "sourceUri"         — endereço externo de onde os bytes vieram.
--
-- O que NÃO muda: "documentFileHash" continua obrigatório nos dois casos. O que
-- prova QUAL conteúdo foi lido é o SHA-256 dos bytes enviados ao modelo, não a
-- existência do arquivo em disco.
--
-- O que se PERDE, e é decisão consciente: sem o arquivo, conferir "este trecho
-- está mesmo no documento?" passa a depender de rebaixar da origem, e o hash
-- deixa de ter segunda testemunha — antes era cruzado contra a linha do acervo,
-- agora é declarado pelo mesmo processo que chamou o modelo. Em troca, a
-- evidência com trecho e localizador deixa de ser conforto e vira a cópia do
-- texto que sustentou cada campo. Precedente na casa: climate_studies e
-- analysis_evidences já gravam fonte externa consultada ao vivo desde julho.

ALTER TABLE "ai_extraction_executions"
  ALTER COLUMN "documentVersionId" DROP NOT NULL,
  -- 1000 acompanha managed_document_versions."uri"; URL de arquivo do PNCP com
  -- parâmetros passa dos 600 de scouted_tenders."noticeUrl".
  ADD COLUMN "sourceUri" VARCHAR(1000),
  -- Sem arquivo guardado, é só isto que descreve o que o modelo recebeu.
  ADD COLUMN "sourceFilename" VARCHAR(255),
  ADD COLUMN "sourceMimeType" VARCHAR(160),
  ADD COLUMN "sourceSizeBytes" BIGINT,
  -- Quando os bytes foram buscados. Fonte externa muda sem avisar; sem carimbo
  -- não há como dizer se a leitura descreve o edital de hoje ou o de antes da
  -- retificação.
  ADD COLUMN "sourceFetchedAt" TIMESTAMPTZ(6);

-- Uma procedência por execução: ou o acervo, ou o endereço externo. Nunca as
-- duas (duas fontes e um só hash: ninguém saberia qual foi lida) e nunca
-- nenhuma. As linhas já gravadas atendem sem tocar em nada — até esta migração
-- "documentVersionId" era NOT NULL e "sourceUri" não existia.
ALTER TABLE "ai_extraction_executions"
  ADD CONSTRAINT "ai_extraction_one_source"
  CHECK (num_nonnulls("documentVersionId", "sourceUri") = 1);

-- Fonte efêmera é um pacote: endereço, nome, tipo, tamanho e data de captura
-- andam juntos ou nenhum aparece. Meia identificação é pior que nenhuma.
ALTER TABLE "ai_extraction_executions"
  ADD CONSTRAINT "ai_extraction_ephemeral_complete"
  CHECK (
    ("sourceUri" IS NULL AND "sourceFilename" IS NULL AND "sourceMimeType" IS NULL
      AND "sourceSizeBytes" IS NULL AND "sourceFetchedAt" IS NULL)
    OR
    ("sourceUri" IS NOT NULL AND "sourceFilename" IS NOT NULL AND "sourceMimeType" IS NOT NULL
      AND "sourceSizeBytes" IS NOT NULL AND "sourceFetchedAt" IS NOT NULL)
  );

ALTER TABLE "ai_extraction_executions"
  ADD CONSTRAINT "ai_extraction_source_size_positive"
  CHECK ("sourceSizeBytes" IS NULL OR "sourceSizeBytes" > 0);

-- O hash dos bytes sustenta a evidência nos dois caminhos. Enquanto havia
-- arquivo, a forma vinha garantida de empréstimo pela CHECK de
-- managed_document_versions; sem arquivo, passa a ser exigida aqui.
ALTER TABLE "ai_extraction_executions"
  ADD CONSTRAINT "ai_extraction_document_hash_sha256"
  CHECK ("documentFileHash" ~ '^[a-f0-9]{64}$');

COMMENT ON COLUMN "ai_extraction_executions"."sourceUri" IS
'Endereco externo dos bytes lidos, quando o arquivo nao e preservado no acervo; nulo quando a leitura partiu de documentVersionId.';

-- A evidência acompanha a execução: se a execução pode não ter arquivo, o
-- trecho citado também não tem versão documental a que se prender. O vínculo
-- que sustenta a citação continua sendo o hash, conferido pelo gatilho.
ALTER TABLE "ai_extraction_evidence"
  ALTER COLUMN "documentVersionId" DROP NOT NULL;

ALTER TABLE "ai_extraction_evidence"
  ADD CONSTRAINT "ai_extraction_evidence_hash_sha256"
  CHECK ("documentFileHash" ~ '^[a-f0-9]{64}$');

-- A validação de entrada exigia "existe versão documental cujo hash bate".
-- Sem arquivo não há o que comparar: da fonte efêmera exige-se o endereço e a
-- data de captura. Sem esta troca, TODA execução com "documentVersionId" nulo
-- morre em 'Hash da fonte documental divergente.' — a linha some no SELECT e
-- document_hash volta nulo. Todo o restante da função é o original, palavra
-- por palavra.
CREATE OR REPLACE FUNCTION gsipro_validate_ai_extraction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE definition_record record; document_hash char(64); latest_id uuid;
BEGIN
  IF NEW.status <> 'RUNNING' OR NEW."completedAt" IS NOT NULL OR NEW.output IS NOT NULL OR NEW.confidence IS NOT NULL THEN
    RAISE EXCEPTION 'Nova execução de IA deve iniciar sem resultado e com status RUNNING.';
  END IF;
  SELECT d."modelVersionId", m.status INTO definition_record
    FROM ai_use_case_definitions d JOIN ai_model_versions m ON m.id=d."modelVersionId"
    WHERE d.id=NEW."definitionId" AND EXISTS(SELECT 1 FROM ai_use_case_approvals a WHERE a."definitionId"=d.id);
  IF NOT FOUND OR definition_record."modelVersionId" <> NEW."modelVersionId" OR definition_record.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Execução exige caso aprovado e modelo ativo correspondente.';
  END IF;
  SELECT id INTO latest_id FROM ai_use_case_definitions
    WHERE "useCaseKey"=(SELECT "useCaseKey" FROM ai_use_case_definitions WHERE id=NEW."definitionId")
    ORDER BY version DESC LIMIT 1;
  IF latest_id <> NEW."definitionId" THEN RAISE EXCEPTION 'Execução exige a versão mais recente do caso de uso.'; END IF;
  IF NEW."documentVersionId" IS NOT NULL THEN
    SELECT "fileHash" INTO document_hash FROM managed_document_versions WHERE id=NEW."documentVersionId";
    IF document_hash IS NULL OR document_hash <> NEW."documentFileHash" THEN RAISE EXCEPTION 'Hash da fonte documental divergente.'; END IF;
  ELSIF NEW."sourceUri" IS NULL OR NEW."sourceFetchedAt" IS NULL THEN
    RAISE EXCEPTION 'Execução sem arquivo arquivado exige endereço de origem e data de captura.';
  END IF;
  RETURN NEW;
END $$;

-- As colunas novas entram na comparação de imutabilidade: a procedência é dado
-- de ENTRADA, e entrada de execução de IA não se reescreve depois do resultado.
CREATE OR REPLACE FUNCTION gsipro_guard_ai_extraction_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'RUNNING' OR NEW.status NOT IN ('SUCCEEDED','FAILED') OR NEW."completedAt" IS NULL THEN
    RAISE EXCEPTION 'Transição de execução de IA inválida.';
  END IF;
  IF ROW(OLD.id,OLD."idempotencyKey",OLD."definitionId",OLD."modelVersionId",OLD."documentVersionId",OLD."documentFileHash",OLD."sourceUri",OLD."sourceFilename",OLD."sourceMimeType",OLD."sourceSizeBytes",OLD."sourceFetchedAt",OLD."requestedFields",OLD.instructions,OLD."inputHash",OLD."startedAt",OLD."createdBy",OLD."correlationId",OLD."createdAt")
     IS DISTINCT FROM ROW(NEW.id,NEW."idempotencyKey",NEW."definitionId",NEW."modelVersionId",NEW."documentVersionId",NEW."documentFileHash",NEW."sourceUri",NEW."sourceFilename",NEW."sourceMimeType",NEW."sourceSizeBytes",NEW."sourceFetchedAt",NEW."requestedFields",NEW.instructions,NEW."inputHash",NEW."startedAt",NEW."createdBy",NEW."correlationId",NEW."createdAt") THEN
    RAISE EXCEPTION 'Dados de entrada da execução de IA são imutáveis.';
  END IF;
  IF NEW.status='SUCCEEDED' AND (NEW.output IS NULL OR NEW.confidence IS NULL OR NEW.limitations IS NULL OR NEW."providerResponseId" IS NULL OR NEW."errorCode" IS NOT NULL) THEN
    RAISE EXCEPTION 'Execução concluída exige resultado, confiança, limitações e resposta do provedor.';
  END IF;
  IF NEW.status='FAILED' AND (NEW."errorCode" IS NULL OR NEW.output IS NOT NULL) THEN
    RAISE EXCEPTION 'Execução falha exige código de erro e não pode conter resultado.';
  END IF;
  RETURN NEW;
END $$;

-- O teste antigo usava "source_version IS NULL" para dizer "execução não
-- existe". Com fonte efêmera, nulo passa a ser resposta legítima, e a execução
-- inexistente tem de ser detectada por NOT FOUND. IS DISTINCT FROM porque
-- nulo = nulo tem de casar. Sem esta troca, nenhuma evidência de leitura
-- efêmera consegue ser gravada.
CREATE OR REPLACE FUNCTION gsipro_validate_ai_extraction_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_version uuid; source_hash char(64);
BEGIN
  SELECT "documentVersionId","documentFileHash" INTO source_version,source_hash FROM ai_extraction_executions WHERE id=NEW."executionId";
  IF NOT FOUND OR source_version IS DISTINCT FROM NEW."documentVersionId" OR source_hash <> NEW."documentFileHash" THEN
    RAISE EXCEPTION 'Evidência de IA deve apontar para a mesma fonte imutável da execução.';
  END IF;
  IF btrim(NEW.excerpt)='' OR btrim(NEW.locator)='' THEN RAISE EXCEPTION 'Evidência de IA exige trecho e localizador.'; END IF;
  RETURN NEW;
END $$;
