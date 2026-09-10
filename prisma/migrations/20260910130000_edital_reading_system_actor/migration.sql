-- Leitura de edital disparada pela própria varredura, sem usuário humano.
--
-- Até aqui "readById" era obrigatório: toda leitura precisava de uma sessão
-- autenticada por trás. A varredura de domingo agora lê o edital de cada
-- licitação nova assim que ela entra na fila (casamento de padrão, sem IA) —
-- não existe requisição HTTP, não existe usuário, e portanto não existe quem
-- apontar em "readById".
--
-- Este campo é escrito, nunca lido de volta pela aplicação (nenhuma tela ou
-- export o consulta) — existe só para o rastro de auditoria. Torná-lo opcional
-- não tem efeito colateral em nada que já leia esta tabela.

ALTER TABLE "scouted_tender_edital_readings"
  ALTER COLUMN "readById" DROP NOT NULL;
