/**
 * Quais licitações do período são a MESMA obra publicada mais de uma vez e,
 * por isso, não podem somar duas vezes nos números da Análise.
 *
 * ⚠️ POR QUE ISTO EXISTE E NÃO É UMA COLUNA NO BANCO. A faxina de duplicatas
 * da varredura só alcança quem ainda está na fila: assim que alguém aprova as
 * duas publicações, elas ficam fora do alcance dela para sempre — e
 * descartar uma licitação já aprovada levaria junto a oportunidade, a ficha,
 * o edital baixado e os requisitos lidos. Marcar no banco resolveria, mas
 * exigiria uma coluna nova, e o deploy deste projeto NÃO aplica migração
 * nenhuma (conferido em `.github/workflows/deploy-hml.yml`, 24/09/2026): o
 * código subiria referenciando uma coluna inexistente e derrubaria a tela
 * inteira. Então a conta é feita na hora de somar, sobre o que já está no
 * banco, e vale retroativamente sem ninguém precisar rodar nada.
 *
 * ⚠️ A REGRA É A DO DOMÍNIO, não uma segunda versão em SQL. Reescrever o
 * agrupamento por órgão + processo + objeto numa consulta criaria duas
 * implementações que divergem no primeiro ajuste — e a que ninguém testa é a
 * que decide o número que a diretoria lê.
 *
 * ⚠️ A cópia continua inteira no banco e continua aparecendo no Buscador.
 * Isto aqui não apaga nem esconde: só impede que a mesma obra seja contada
 * duas vezes.
 */
import { getDatabase } from "@/core/database/prisma";
import { resolverCopias } from "@/modules/scouting/domain/duplicates";

/**
 * `externalId` das publicações que NÃO devem entrar nas contagens do período.
 *
 * Vazio é o caso normal. O conjunto é recalculado a cada carregamento, o que
 * é barato para a ordem de grandeza desta base (centenas) e sempre reflete o
 * estado atual — inclusive quando alguém aprova ou descarta uma delas.
 */
export async function copiasDoPeriodo(de: Date, ate: Date): Promise<readonly string[]> {
  const registros = await getDatabase().scoutedTender.findMany({
    where: { createdAt: { gte: de, lt: ate } },
    select: {
      externalId: true,
      authorityDocument: true,
      authorityName: true,
      processNumber: true,
      subject: true,
      proposalOpensAt: true,
      createdAt: true,
      opportunityId: true,
      status: true,
    },
  });
  if (registros.length < 2) return [];

  // ⚠️ A chave devolvida é o `externalId`, não o `id`: ele é VARCHAR no
  // banco, então a consulta compara texto com texto e dispensa converter
  // tipo — um ponto a menos onde o Postgres pode recusar a comparação.
  const copias = resolverCopias(registros.map((tender) => ({
    id: tender.externalId,
    ...(tender.authorityDocument ? { authorityDocument: tender.authorityDocument } : {}),
    authorityName: tender.authorityName,
    ...(tender.processNumber ? { processNumber: tender.processNumber } : {}),
    subject: tender.subject,
    ...(tender.proposalOpensAt ? { publishedAt: tender.proposalOpensAt } : {}),
    createdAt: tender.createdAt,
    temOportunidade: tender.opportunityId !== null,
    descartada: tender.status === "DISCARDED",
  })));

  return [...copias.keys()];
}

/**
 * Lista pronta para `NOT IN` no SQL. São `externalId`, não `id`.
 *
 * ⚠️ `NOT IN (...)` com lista vazia é erro de sintaxe no Postgres, e
 * `NOT IN (NULL)` descarta TODAS as linhas em silêncio — o pior desfecho
 * possível, porque a tela fica vazia sem nenhum erro. Por isso o caso sem
 * cópia devolve um id impossível em vez de uma lista vazia.
 */
export function paraConsulta(ids: readonly string[]): readonly string[] {
  return ids.length > 0 ? ids : ["sem-copia-nenhuma"];
}
