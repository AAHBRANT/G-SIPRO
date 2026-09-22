/**
 * Monta o funil comercial direto no banco, agregado por mês.
 *
 * A agregação é SQL de propósito: trazer licitação por licitação para somar no
 * servidor — ou pior, no navegador — não escala e obriga a repetir a mesma
 * conta em três lugares (cards, gráfico e exportação).
 *
 * ⚠️ COORTE POR ENTRADA NA FILA. O mês de toda etapa é o de `createdAt` do
 * registro da fila, nunca o mês em que a etapa aconteceu. Um estudo concluído
 * em setembro sobre licitação de julho conta em julho. Sem isso, a razão entre
 * duas etapas compara conjuntos diferentes e pode passar de 100% sem nenhum
 * erro de dado. Ver o aviso em `funil-comercial`.
 *
 * ⚠️ O que o portal PUBLICOU é o único número que não vem da fila: sai de
 * `scout_runs.totalFetched`, o total que a varredura leu. Ele é somado por mês
 * da execução, e a mesma licitação aparece de novo a cada varredura que a
 * reencontra — por isso a tela apresenta esse número como leitura do robô, com
 * ressalva, e não como universo de licitações distintas.
 */
import { getDatabase } from "@/core/database/prisma";
import type { MesDoFunil } from "@/modules/analysis/domain/funil-comercial";

type LinhaDoBanco = Readonly<{
  mes: Date;
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

type LinhaDeVarredura = Readonly<{ mes: Date; publicados: bigint | null }>;

const inteiro = (v: bigint | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

/**
 * Decimal do Prisma chega como objeto, string ou número conforme o driver.
 * Valor ausente NÃO é zero: vira nulo e a tela diz "indisponível".
 */
const dinheiro = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
};

const chaveDoMes = (d: Date) => d.toISOString().slice(0, 10);

export type FunilDoPeriodo = Readonly<{
  meses: readonly MesDoFunil[];
  /** Licitações sem valor estimado informado, por mês — a tela avisa quando há. */
  semValorPorMes: Readonly<Record<string, number>>;
}>;

export class PrismaFunilRepository {
  /**
   * `de` inclusivo, `ate` exclusivo, ambos no primeiro dia do mês em UTC.
   */
  async carregar(de: Date, ate: Date): Promise<FunilDoPeriodo> {
    const banco = getDatabase();

    const [linhas, varreduras] = await Promise.all([
      banco.$queryRaw<LinhaDoBanco[]>`
        WITH base AS (
          SELECT
            date_trunc('month', st."createdAt") AS mes,
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
        GROUP BY mes
        ORDER BY mes
      `,
      banco.$queryRaw<LinhaDeVarredura[]>`
        SELECT date_trunc('month', "startedAt") AS mes, sum("totalFetched") AS publicados
        FROM scout_runs
        WHERE "startedAt" >= ${de} AND "startedAt" < ${ate} AND status = 'COMPLETED'
        GROUP BY mes
        ORDER BY mes
      `,
    ]);

    const publicadosPorMes = new Map<string, number | null>();
    for (const linha of varreduras) {
      publicadosPorMes.set(chaveDoMes(linha.mes), linha.publicados === null ? null : Number(linha.publicados));
    }

    const semValorPorMes: Record<string, number> = {};
    const meses = linhas.map((linha): MesDoFunil => {
      const chave = chaveDoMes(linha.mes);
      semValorPorMes[chave] = inteiro(linha.sem_valor);
      return {
        mes: chave,
        // Mês sem varredura concluída fica NULO, não zero: é informação que
        // falta, e zero rebaixaria o denominador inflando a aderência.
        publicados: publicadosPorMes.has(chave) ? publicadosPorMes.get(chave)! : null,
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
      };
    });

    return { meses, semValorPorMes };
  }
}
