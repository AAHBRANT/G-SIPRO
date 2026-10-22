-- Leitura do edital passa a ler também os anexos (pedido do dono, 22/10/2026):
-- termo de referência, projeto básico, memorial — muitas vezes o edital em si
-- só diz "conforme anexo".
--
-- 1. "sourceDocuments": quais documentos a leitura percorreu, para a aba
--    Edital mostrar de onde veio cada informação. Lista de
--    { filename, uri }. Vazia nas leituras anteriores a esta mudança — é por
--    ela vazia que a varredura sabe quais leituras antigas reler com anexos.
--
-- 2. "requiresProposalBond": a garantia de proposta já era lida, mas não
--    tinha coluna e se perdia ao gravar — a tela mostrava sempre "não
--    encontrado". Nulo = a leitura não determinou.
--
-- Só acrescenta colunas com valor padrão/nulo: nenhuma linha existente muda.

ALTER TABLE "scouted_tender_edital_readings"
  ADD COLUMN "sourceDocuments" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "requiresProposalBond" BOOLEAN;
