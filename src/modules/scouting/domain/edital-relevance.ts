/**
 * Qual documento do pacote traz a exigência de acervo.
 *
 * Um pacote de licitação de obra tem de 15 a 30 arquivos, e o que decide
 * habilitação está num só. No caso real que motivou este módulo — Concorrência
 * 17/2026 de Pedra Preta/MT — o pacote tinha 18 arquivos, e as seis parcelas de
 * maior relevância com quantitativo mínimo estavam em "Justificativa de
 * Qualificação Técnica.pdf". O EDITAL.pdf apenas remete a ele: quem lesse só o
 * edital sairia sem nenhum quantitativo, que é justamente o número do qual
 * depende o confronto com o acervo.
 *
 * Daí a régua abaixo. O peso 0 é do documento que lista as parcelas; o edital
 * vem depois porque ele traz o resto (consórcio, CAT, visita, garantia) mas
 * quase nunca traz o quantitativo.
 *
 * ⚠️ O peso alto de projeto/prancha/relatório fotográfico não é preciosismo de
 * ordenação: é dinheiro. Cada leitura é uma chamada paga ao provedor, e mandar
 * as 17 MB de PROJETOS.pdf para o modelo procurar parcela de relevância gasta a
 * chamada para não achar nada. Eles continuam elegíveis — só por último.
 *
 * ⚠️ O texto é NORMALIZADO antes de qualquer padrão encostar nele: sem acento,
 * em minúsculas, e com todo separador virando espaço. Sem isso a régua erra do
 * jeito mais silencioso possível:
 *
 *   - `PROJETO_BASICO.pdf` e `JUSTIFICATIVA-DE-QUALIFICACAO-TECNICA.pdf` são a
 *     grafia normal de arquivo publicado por prefeitura, e um `\s+` no padrão
 *     não casa com `_` nem com `-`. O documento que decide habilitação caía
 *     para o fim da fila por causa de um sublinhado.
 *   - `\b` do JavaScript é ASCII: em "CONTAGEM DE TRÁFEGO" o acento conta como
 *     fronteira de palavra, então `\bTR\b` casava "TRÁ" e dava peso de termo de
 *     referência a uma contagem de tráfego.
 */
import { normalizeText } from "@/modules/scouting/domain/qualification";

/** Peso de quem não casou com nenhum padrão: entra depois dos conhecidos. */
const PESO_NEUTRO = 50;

/** Peso do edital: separa "documento que traz a exigência" de "o resto". */
export const PESO_EDITAL = 30;

/**
 * O edital propriamente dito.
 *
 * Vive separado da régua porque o serviço precisa perguntar "este documento é o
 * edital?", e não "o peso dele é 30?". Peso é o mínimo entre todos os padrões
 * que casaram, então um arquivo chamado `EDITAL PREGAO 17-2026 TR.pdf` sai com
 * peso 10 e continua sendo o edital — comparar o número deixaria a segunda
 * leitura (consórcio, CAT, visita) sem acontecer, calada.
 */
const EDITAL = /(^| )edital/;

const REGUA: ReadonlyArray<Readonly<{ pattern: RegExp; weight: number }>> = [
  // A justificativa de qualificação técnica é o documento que o órgão publica
  // para fundamentar a exigência: ele lista serviço, quantitativo orçado e o
  // percentual exigido. Quando existe, é ele que manda.
  { pattern: /qualificacao tecnica|parcelas? de maior relevancia/, weight: 0 },
  { pattern: /termo de referencia|(^| )tr( |$)/, weight: 10 },
  { pattern: /projeto basico|projeto executivo/, weight: 20 },
  // O edital fecha o que falta: consórcio, CAT/CAO, visita, garantia.
  { pattern: EDITAL, weight: PESO_EDITAL },
  { pattern: /memorial descritivo/, weight: 40 },
  { pattern: /anexo/, weight: 45 },
  // Caros e mudos quanto a habilitação.
  { pattern: /projetos|prancha|desenho|planta|fotografic|memoria de calculo|dimensionamento|orcamento|cronograma|curva abc|quadro/, weight: 90 },
];

/**
 * Reduz o texto ao que a régua sabe ler: sem acento, minúsculo, e com hífen,
 * sublinhado, ponto e parêntese virando espaço.
 */
function normalizar(texts: ReadonlyArray<string | undefined>): string {
  const alvo = texts.filter((t): t is string => typeof t === "string" && t.length > 0).join(" ");
  return normalizeText(alvo).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Este documento é o edital, seja qual for o peso que ele tenha recebido. */
export function isEdital(...texts: ReadonlyArray<string | undefined>): boolean {
  return EDITAL.test(normalizar(texts));
}

/**
 * Peso de um documento, do mais provável de trazer a exigência para o menos.
 *
 * Recebe os textos que descrevem o arquivo — tipo declarado pelo órgão, título
 * na listagem, nome do arquivo, caminho dentro do pacote — porque nenhum deles
 * é confiável sozinho: o PNCP costuma declarar tudo como "Anexo" e batizar o
 * arquivo de `199051_editais_1787665929.zip`, e o nome que interessa só aparece
 * lá dentro.
 */
export function editalRelevance(...texts: ReadonlyArray<string | undefined>): number {
  const alvo = normalizar(texts);
  if (!alvo) return PESO_NEUTRO;
  // O menor peso entre os padrões que casaram, e não o primeiro: "ANEXO I -
  // Termo de Referência" tem de valer como termo de referência.
  const pesos = REGUA.filter((item) => item.pattern.test(alvo)).map((item) => item.weight);
  return pesos.length > 0 ? Math.min(...pesos) : PESO_NEUTRO;
}
