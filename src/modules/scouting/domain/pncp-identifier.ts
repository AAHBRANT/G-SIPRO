/**
 * Identificador de uma contratação no PNCP.
 *
 * O número de controle vem no formato `CNPJ-1-SEQUENCIAL/ANO`, por exemplo
 * `07658917000127-1-000114/2025`. É dele que saem as três partes necessárias
 * para pedir os arquivos do edital — a consulta pública não devolve um endereço
 * pronto para eles.
 *
 * Ler daqui, e não do `noticeUrl`, é decisão consciente: a URL é montada pela
 * própria aplicação a partir destes mesmos campos, então usá-la seria confiar
 * numa cópia quando o original está à mão.
 */

export type PncpIdentifier = Readonly<{
  authorityDocument: string;
  year: number;
  sequence: number;
}>;

const PATTERN = /^(\d{14})-\d+-(\d+)\/(\d{4})$/;

/**
 * Lê o número de controle. Devolve `null` quando o formato não bate — o que
 * acontece de verdade: nem todo órgão publica no padrão, e chutar as partes
 * levaria a pedir o edital de outra licitação.
 */
export function parsePncpIdentifier(externalId: string): PncpIdentifier | null {
  const match = PATTERN.exec(externalId.trim());
  if (!match) return null;

  const [, authorityDocument, sequencial, ano] = match;
  const sequence = Number(sequencial);
  const year = Number(ano);

  // O sequencial vem com zeros à esquerda — "000114" é a compra 114.
  if (!Number.isInteger(sequence) || sequence <= 0) return null;
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return null;

  return { authorityDocument: authorityDocument!, year, sequence };
}
