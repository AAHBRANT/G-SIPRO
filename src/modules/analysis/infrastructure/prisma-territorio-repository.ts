/**
 * Agrega o funil por mês, unidade da federação, esfera do órgão e município.
 *
 * Mesma base do funil comercial e mesmo critério de coorte — mês de entrada
 * na fila, nunca o mês em que a etapa aconteceu. As duas telas precisam bater:
 * se o mapa contasse por outro critério, a soma dos estados não fecharia com
 * o card do topo e a tela perderia a credibilidade inteira por causa de uma
 * diferença que ninguém conseguiria explicar.
 *
 * ⚠️ A granularidade (mês × UF × esfera × município) é de propósito: todo
 * recorte da seção acontece na tela, sem nova ida ao banco. O teto é o número
 * de licitações do período — ordens de grandeza menos do que trazer cada
 * licitação com todos os seus campos.
 *
 * ⚠️ `state` e `city` são da UNIDADE DO ÓRGÃO que publicou, não do local da
 * obra. Ver o aviso no topo de `territorio.ts`; a tela repete isso.
 *
 * ⚠️ A coordenada é resolvida AQUI, no servidor, e só para os municípios que
 * aparecem no período. A tabela dos 5.570 municípios nunca atravessa para o
 * navegador.
 */
import { Prisma } from "@/generated/prisma/client";

import { getDatabase } from "@/core/database/prisma";
import { copiasDoPeriodo, paraConsulta } from "@/modules/analysis/infrastructure/copias-de-licitacao";
import { acharMunicipio, chaveDoMunicipio } from "@/modules/analysis/infrastructure/municipios-brasil";
import type { CelulaTerritorial, LicitacaoDoRecorte, MunicipioNoMapa } from "@/modules/analysis/domain/territorio";

type LinhaDoBanco = Readonly<{
  mes: Date;
  uf: string | null;
  esfera: string | null;
  cidade: string | null;
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

type LinhaDeRegistro = Readonly<{
  id: string;
  externalId: string;
  subject: string;
  uf: string | null;
  cidade: string | null;
  esfera: string | null;
  autoridade: string;
  captadaEm: Date;
  fechaEm: Date | null;
  valor: unknown;
  aprovada: boolean;
  tem_orcamento: boolean;
  tem_proposta: boolean;
}>;

/**
 * Teto de licitações que a lista do recorte carrega.
 *
 * ⚠️ A lista é a única parte desta tela que leva registro individual ao
 * navegador; todo o resto é agregado. O teto existe para que o dia em que a
 * base crescer dez vezes não vire uma página de vários megabytes sem ninguém
 * perceber — a tela avisa quando cortou.
 */
const TETO_DE_REGISTROS = 400;

const inteiro = (v: bigint | null | undefined): number => (v === null || v === undefined ? 0 : Number(v));

/** Decimal do Prisma chega como objeto, string ou número conforme o driver. */
const dinheiro = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
};

export type DadosTerritoriais = Readonly<{
  celulas: readonly CelulaTerritorial[];
  /** Só os municípios que têm licitação no período, já com coordenada. */
  municipios: readonly MunicipioNoMapa[];
  registros: readonly LicitacaoDoRecorte[];
  /** Verdadeiro quando a lista bateu no teto e não traz tudo. */
  registrosCortados: boolean;
}>;

export class PrismaTerritorioRepository {
  /** `de` inclusivo, `ate` exclusivo, ambos no primeiro dia do mês em UTC. */
  async carregar(de: Date, ate: Date): Promise<DadosTerritoriais> {
    const banco = getDatabase();
    const copias = paraConsulta(await copiasDoPeriodo(de, ate));

    const [linhas, registros] = await Promise.all([
      banco.$queryRaw<LinhaDoBanco[]>`
        WITH base AS (
          SELECT
            date_trunc('month', st."createdAt") AS mes,
            st.state AS uf,
            st.sphere AS esfera,
            st.city AS cidade,
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
            -- ⚠️ A mesma obra publicada duas vezes não pode somar duas
            -- vezes. Ver copias-de-licitacao.ts: a cópia continua no banco,
            -- inteira, e sai só das contagens.
            AND st."externalId" NOT IN (${Prisma.join(copias)})
        )
        SELECT
          mes,
          uf,
          esfera,
          cidade,
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
        GROUP BY mes, uf, esfera, cidade
        ORDER BY mes, uf
      `,
      // ⚠️ `nulls last`: sem valor informado não é a licitação mais barata do
      // país. O padrão do Postgres para DESC já é nulo primeiro, o que poria
      // justamente o orçamento sigiloso no topo de uma lista ordenada por valor.
      banco.$queryRaw<LinhaDeRegistro[]>`
        SELECT
          st.id,
          st."externalId",
          st.subject,
          st.state AS uf,
          st.city AS cidade,
          st.sphere AS esfera,
          st."authorityName" AS autoridade,
          st."createdAt" AS "captadaEm",
          st."proposalClosesAt" AS "fechaEm",
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
          -- Ver acima: a cópia não entra na lista nem nas somas.
          AND st."externalId" NOT IN (${Prisma.join(copias)})
        ORDER BY st."estimatedValue" DESC NULLS LAST, st."createdAt" DESC
        LIMIT ${TETO_DE_REGISTROS + 1}
      `,
    ]);

    const celulas = linhas.map((linha): CelulaTerritorial => ({
      mes: linha.mes.toISOString().slice(0, 10),
      uf: linha.uf,
      // Esfera ausente vira string vazia, que `esferaConhecida` recusa: é o
      // caminho que mantém a licitação nos totais sem classificá-la à força.
      esfera: linha.esfera ?? "",
      cidade: linha.cidade,
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

    return {
      celulas,
      municipios: this.municipiosComCoordenada(celulas),
      registros: registros.slice(0, TETO_DE_REGISTROS).map((linha): LicitacaoDoRecorte => ({
        id: linha.id,
        identificador: linha.externalId,
        objeto: linha.subject,
        uf: linha.uf,
        cidade: linha.cidade,
        esfera: linha.esfera ?? "",
        autoridade: linha.autoridade,
        captadaEm: linha.captadaEm.toISOString(),
        fechaEm: linha.fechaEm ? linha.fechaEm.toISOString() : null,
        valor: dinheiro(linha.valor),
        aprovada: linha.aprovada,
        estudoConcluido: linha.aprovada && linha.tem_orcamento,
        propostaEnviada: linha.aprovada && linha.tem_proposta,
      })),
      registrosCortados: registros.length > TETO_DE_REGISTROS,
    };
  }

  /**
   * Resolve a coordenada de cada município presente, uma vez por par
   * nome+UF. Município que a base não conhece (grafia diferente, distrito,
   * consórcio intermunicipal) fica sem ponto e continua em todos os totais.
   */
  private municipiosComCoordenada(celulas: readonly CelulaTerritorial[]): readonly MunicipioNoMapa[] {
    const vistos = new Map<string, MunicipioNoMapa>();
    for (const celula of celulas) {
      if (!celula.cidade || !celula.uf) continue;
      const uf = celula.uf.trim().toUpperCase();
      const chave = `${chaveDoMunicipio(celula.cidade)}|${uf}`;
      if (vistos.has(chave)) continue;
      const achado = acharMunicipio(celula.cidade, uf);
      if (!achado) continue;
      vistos.set(chave, {
        chave,
        nome: celula.cidade.trim(),
        uf,
        ibge: achado.ibge,
        latitude: achado.latitude,
        longitude: achado.longitude,
      });
    }
    return [...vistos.values()];
  }
}
