-- Buscador G-SIPRO (APP-MOD-201) — parte 1 de 2: origem da oportunidade.
--
-- Isolada em migration própria de propósito. "ALTER TYPE ... ADD VALUE" tem
-- restrição de transação no PostgreSQL: até a versão 11 não pode ser executado
-- dentro de bloco transacional, e a partir da 12 o novo valor não pode ser
-- usado na mesma transação em que foi criado. Mantendo-a sozinha, a criação das
-- tabelas (parte 2) fica livre desse acoplamento e uma eventual falha aqui é
-- inequívoca.
ALTER TYPE "OpportunityOrigin" ADD VALUE IF NOT EXISTS 'BUSCADOR';
