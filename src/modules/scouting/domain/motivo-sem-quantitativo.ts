/**
 * Por que a leitura terminou sem quantitativo nenhum (pedido do dono,
 * 23/10/2026: "esses 49% como resolvemos?"). Medido no corpus de 140 obras
 * do PNCP: boa parte do que parecia falha do leitor não é — o edital não
 * pede quantitativo, ou a exigência está num documento que o órgão não
 * publicou no PNCP. Dizer isso na tela vale mais do que deixar em branco.
 *
 * Só é chamado quando a leitura já juntou edital e anexos e continuou sem
 * nenhuma parcela com quantidade.
 */

export const MOTIVO_SO_SIMILAR = "o edital pede atestado de obra ou serviço similar, sem quantitativo mínimo";
export const MOTIVO_REMISSAO = "a exigência de quantitativos remete ao Termo de Referência (ou anexo citado), que não está entre os documentos publicados no PNCP";
export const MOTIVO_DIGITALIZADO = "documentos digitalizados (imagem), sem texto: a leitura automática não é possível — confira o edital à mão";
/**
 * Quando nenhum dos motivos acima se confirma. No corpus de 23/10/2026, um em
 * cada quatro editais caía aqui — exigência só no anexo de formulários, texto
 * de lei sem exigência concreta, concorrência de projeto. Afirmar "não exige"
 * seria chute; dizer o que se sabe é honesto e evita o campo em branco.
 */
export const MOTIVO_NAO_ENCONTRADO = "nenhum quantitativo mínimo encontrado nos documentos lidos — confira a qualificação técnica no edital";

const SECAO = /qualifica[çc][ãa]o\s+t[ée]cnica|t[ée]cnico[\s-]*operacional|capacidade\s+t[ée]cnica|parcelas?\s+de\s+maior\s+relev[âa]ncia/i;

/** "quantidades … conforme item 9.1.3 do Anexo I – Termo de Referência". */
const REMISSAO = /(?:quantidades?|quantitativos?|parcelas?\s+de\s+maior\s+relev[âa]ncia|qualifica[çc][ãa]o\s+t[ée]cnica)[^.;]{0,160}(?:conforme|constantes?|previst[ao]s?|definid[ao]s?|estabelecid[ao]s?|descrit[ao]s?|indicad[ao]s?)\s+(?:n[oa]s?\s+|d[oa]s?\s+)?(?:item\s+[\d.]+\s+d[oa]\s+)?(?:anexo\s+[ivxl\d]+\s*[–—-]?\s*)?(?:termo\s+de\s+refer[êe]ncia|projeto\s+b[áa]sico|anexo\s+[ivxl\d]+)/i;

/** Atestado de obra/serviço "similar", "de características semelhantes", "compatível". */
const SIMILAR = /(?:obras?|servi[çc]os?)\s+(?:de\s+)?(?:caracter[íi]sticas\s+)?(?:semelhantes?|similar(?:es)?|compat[íi]ve(?:l|is)|equivalentes?)/i;
/** Indício de que há, sim, exigência quantitativa — aí "similar" não basta para afirmar. */
const QUANTITATIVO = /quantidades?\s+m[íi]nimas?|quantitativos?\s+m[íi]nimos?|n[ãa]o\s+inferior\s+a|no\s+m[íi]nimo|parcelas?\s+de\s+maior\s+relev[âa]ncia\s*(?::|s[ãa]o|abaixo)/i;

/** Documento lido que é o termo de referência (ou projeto básico). */
const EH_TR = /termo\s*de\s*refer[êe]ncia|projeto\s*b[áa]sico|(^|[^a-z])tr([^a-z]|$)/i;

export function motivoSemQuantitativo(
  textos: readonly string[],
  documentosLidos: readonly string[],
): string | undefined {
  const comTexto = textos.filter((t) => t.trim().length > 0);
  if (comTexto.length === 0) return textos.length > 0 ? MOTIVO_DIGITALIZADO : undefined;

  const tudo = comTexto.join("\n").replace(/\s+/g, " ");
  if (!SECAO.test(tudo)) return MOTIVO_NAO_ENCONTRADO;

  const leuTr = documentosLidos.some((nome) => EH_TR.test(nome));
  if (!leuTr && REMISSAO.test(tudo)) return MOTIVO_REMISSAO;

  // "Similar" só é afirmado quando nada no texto indica exigência quantitativa.
  if (SIMILAR.test(tudo) && !QUANTITATIVO.test(tudo)) return MOTIVO_SO_SIMILAR;
  return MOTIVO_NAO_ENCONTRADO;
}
