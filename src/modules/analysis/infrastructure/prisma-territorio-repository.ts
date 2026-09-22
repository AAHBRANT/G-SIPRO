/**
 * Agrega o funil por mês, unidade da federação e esfera do órgão.
 *
 * Mesma base do funil comercial e mesmo critério de coorte — mês de entrada
 * na fila, nunca o mês em que a etapa aconteceu. As duas telas precisam bater:
 * se o mapa contasse por outro critério, a soma dos estados não fecharia com
 * o card do topo e a tela perderia a credibilidade inteira por causa de uma
 * diferença que ninguém conseguiria explicar.
 *
 * ⚠️ A granularidade (mês × UF × esfera) é de propósito: o recorte de período
 * e o filtro de esfera acontecem na tela, sem nova ida ao banco. São no máximo
 * 27 × 4 × meses linhas — ordens de grandeza menos do que trazer licitação por
 * licitação, e ainda assim suficiente para todo cruzamento que o mapa oferece.
 *
 * ⚠️ `state` é a UF da UNIDADE DO ÓRGÃO que publicou, não o local da obra. Ver
 * o aviso no topo de `territorio.ts`; a tela repete isso para quem lê.
 */
import { getDatabase } from "@/core/database/prisma";
import type { CelulaTerritorial } from "@/modules/analysis/domain/territorio";

type LinhaDoBanco = Readonly<{
  mes: Date;
  uf: string | null;
  esfera: string | null;
  aderentes: bigint;
  aprovadas: bigint;
  orcamento: bigint;
  propostas: bigint;
  valor_aderentes: unknown;
  valor_aprovadas: unknown;
  valor_orcamento: unknown;
  valor_propostas: unknown;
  sem_valor: bigint;
}>;

const inteiro = (v: bigint | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

/** Decimal do Prisma chega como objeto, string ou número conforme o driver. */
const dinheiro = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
};

export class PrismaTerritorioRepository {
  /** `de` inclusivo, `ate` exclusivo, ambos no primeiro dia do mês em UTC. */
  async carregar(de: Date, ate: Date): Promise<readonly CelulaTerritorial[]> {
    const linhas = await getDatabase().$queryRaw<LinhaDoBanco[]>`
      WITH base AS (
        SELECT
          date_trunc('month', st."createdAt") AS mes,
          st.state AS uf,
          st.sphere AS esfera,
          st."estimatedValue" AS valor,
          (st.status = 'APPROVED') AS aprovada,
          EXISTS (
            SELECT 1 FROM opportunity_analyses oa
            WHERE oa."opportunityId" = st."opportunityId" AND oa.status = 'SUCCEEDED'
          ) AS tem_orcamento,
          EXISTS (
            SELECT 1 FROM proposal_submissions ps
            JOIN proposals p ON p.id = ps."proposalId"
            WHERE p."opportunityId" = st."opportunityId"
          ) AS tem_proposta
        FROM scouted_tenders st
        WHERE st."createdAt" >= ${de} AND st."createdAt" < ${ate}
      )
      SELECT
        mes,
        uf,
        esfera,
        count(*) AS aderentes,
        count(*) FILTER (WHERE aprovada) AS aprovadas,
        count(*) FILTER (WHERE aprovada AND tem_orcamento) AS orcamento,
        count(*) FILTER (WHERE aprovada AND tem_proposta) AS propostas,
        sum(valor) AS valor_aderentes,
        sum(valor) FILTER (WHERE aprovada) AS valor_aprovadas,
        sum(valor) FILTER (WHERE aprovada AND tem_orcamento) AS valor_orcamento,
        sum(valor) FILTER (WHERE aprovada AND tem_proposta) AS valor_propostas,
        count(*) FILTER (WHERE valor IS NULL) AS sem_valor
      FROM base
      GROUP BY mes, uf, esfera
      ORDER BY mes, uf
    `;

    return linhas.map((linha): CelulaTerritorial => ({
      mes: linha.mes.toISOString().slice(0, 10),
      uf: linha.uf,
      // Esfera ausente vira string vazia, que `esferaConhecida` recusa: é o
      // caminho que mantém a licitação nos totais sem classificá-la à força.
      esfera: linha.esfera ?? "",
      quantidade: {
        aderentes: inteiro(linha.aderentes),
        aprovadas: inteiro(linha.aprovadas),
        orcamento: inteiro(linha.orcamento),
        propostas: inteiro(linha.propostas),
      },
      valor: {
        aderentes: dinheiro(linha.valor_aderentes),
        aprovadas: dinheiro(linha.valor_aprovadas),
        orcamento: dinheiro(linha.valor_orcamento),
        propostas: dinheiro(linha.valor_propostas),
      },
      semValor: inteiro(linha.sem_valor),
    }));
  }
}
