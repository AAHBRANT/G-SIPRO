/**
 * Lê a exigência técnica do TEXTO do edital, sem IA.
 *
 * Existe porque a leitura por IA custa dinheiro a cada chamada, e ele decidiu
 * que não: "nada pago, você só precisa pegar o acervo técnico exigido,
 * comparar com o nosso". O texto de um edital de obra pública segue uma
 * estrutura bem menos livre do que parece — a Lei 14.133/2021 manda o órgão
 * justificar cada exigência num formato quase fixo (art. 67), e é nesse
 * formato que este módulo se apoia.
 *
 * ⚠️ Isto tem um teto real, mais baixo que o da IA — medido contra o edital
 * real de Pedra Preta/MT (Concorrência 17/2026), não hipotético:
 *  - Consórcio e visita técnica: linguagem bastante padronizada ("vedação de
 *    empresa em consórcio", "poderá declinar da vistoria") — reconhecível.
 *  - CAT/CREA/CAU: quase universal em obra pública; a presença do termo já é
 *    sinal razoável mesmo sem uma frase de sim/não explícita.
 *  - Parcelas de maior relevância: o documento de justificativa costuma trazer
 *    DUAS tabelas parecidas — qualificação técnico-PROFISSIONAL (do
 *    engenheiro, sem quantitativo mínimo) e técnico-OPERACIONAL (da empresa,
 *    com o percentual que decide habilitação). Só a segunda importa, e
 *    achá-la exige ancorar no título da seção, não na tabela em si — as duas
 *    têm cabeçalho de coluna idêntico.
 *  - Garantia de proposta: NÃO extraída. "Garantia de proposta" e "garantia de
 *    EXECUÇÃO contratual" são exigências diferentes, a segunda muito mais
 *    comum, e um gatilho largo o bastante para achar a primeira captura a
 *    segunda com frequência — pior que não capturar nenhuma. Mesma lacuna já
 *    existia na leitura por IA: `EditalRequirement` nunca teve campo para
 *    isto, apesar de `editalFields` pedir.
 *
 * Sem IA, o que este módulo não sabe achar fica de fora — nunca vira palpite.
 * Cada campo não encontrado é uma limitação declarada, do mesmo jeito que a
 * leitura por IA já declarava o que não conseguia determinar. E cada leitura
 * continua "a conferir" até uma pessoa validar — a régua de confiança que já
 * protegia a leitura por IA (`ScoutedTenderEditalReading.reviewedAt`) é
 * exatamente o que torna uma extração mais crua do que a de IA ainda segura
 * de usar: ninguém trata isto como certeza antes de alguém olhar.
 */
import { type EditalRequirement, type RequiredService } from "@/modules/scouting/domain/edital-requirement";
import { normalizeUnit, parseQuantity as parseQuantidadeUnidade } from "@/modules/scouting/domain/quantity";
import { normalizeText } from "@/modules/scouting/domain/qualification";

/** Janela de texto capturada ao redor de um termo-gatilho, para o sim/não. */
const JANELA_CLAUSULA = 220;

/**
 * Sim/não em texto CRU de lei — diferente de `parseBoolean` (edital-
 * requirement.ts), que lê a resposta já curta e reescrita pela IA. Texto de
 * origem prefere o SUBSTANTIVO ("vedação", "exigência") onde a resposta da IA
 * preferia o adjetivo ("vedado", "exigido") — sem os dois, "vedação de
 * consórcio" e "poderá declinar da vistoria" não classificavam nada.
 *
 * Falso é checado ANTES de verdadeiro: a citação de jurisprudência que
 * fundamenta uma vedação costuma mencionar o poder geral de "admitir" antes
 * de dizer que aqui não se admite — o substantivo direto da decisão
 * ("vedação") tem de vencer a palavra genérica da explicação ("admitir").
 */
function simNaoDeTextoCru(texto: string): boolean | undefined {
  const alvo = normalizeText(texto);
  if (/n[ao]o (sera|podera|admite|permite|se admite)|vedad|vedac|proibid|proibic|inadmiss|impedid|dispensad|facultad|poder[ao] declinar|fica a criteri/.test(alvo)) return false;
  if (/permit|admit|autoriz|obrigatori|exigid|exigenc|sera necessari/.test(alvo)) return true;
  return undefined;
}

/**
 * Todas as ocorrências de qualquer um dos gatilhos, na ordem em que aparecem
 * no texto — não só a primeira.
 *
 * ⚠️ A primeira menção de "CAT" ou "visita técnica" num edital real costuma
 * ser só o NOME do documento, listado sob um item numerado ("9.7.3. Certidão
 * de Acervo Técnico – CAT"), sem repetir o verbo de exigência — esse verbo
 * apareceu uma vez, no item-pai, fora da janela. E a primeira menção de
 * "visita técnica" pode ser sobre COMO ela é atestada, não sobre se é
 * obrigatória — a frase que resolve isso ("poderá declinar") vem páginas
 * depois. Por isso quem chama varre todas as ocorrências e fica com a
 * primeira que realmente classificar, em vez de travar na primeira que achar.
 */
function todasAsJanelas(textoOriginal: string, textoNormalizado: string, gatilhos: readonly RegExp[]): readonly string[] {
  const janelas: string[] = [];
  for (const gatilho of gatilhos) {
    for (const casado of textoNormalizado.matchAll(new RegExp(gatilho, "g"))) {
      const inicio = Math.max(0, casado.index - 40);
      const fim = Math.min(textoOriginal.length, casado.index + JANELA_CLAUSULA);
      janelas.push(textoOriginal.slice(inicio, fim));
    }
  }
  return janelas;
}

const CLAUSULA_CONSORCIO: readonly RegExp[] = [/consorcio/];
const CLAUSULA_CAT: readonly RegExp[] = [/\bcat\b|atestado de (responsabilidade|capacidade) tecnica|\bcrea\b|\bcau\b/];
const CLAUSULA_VISITA: readonly RegExp[] = [/visita tecnica|vistoria tecnica/];

/**
 * As três cláusulas institucionais que `EditalRequirement` de fato usa.
 * `undefined` quer dizer "não achou o gatilho, ou achou e nenhuma ocorrência
 * deu para classificar" — os dois casos viram limitação, nunca palpite.
 */
export function extractInstitutionalRequirement(textoOriginal: string): Readonly<{
  consortiumAllowed?: boolean;
  requiresCat?: boolean;
  requiresSiteVisit?: boolean;
  limitations: readonly string[];
}> {
  const alvo = normalizeText(textoOriginal);
  const limitations: string[] = [];

  const ler = (gatilhos: readonly RegExp[], rotulo: string): boolean | undefined => {
    const janelas = todasAsJanelas(textoOriginal, alvo, gatilhos);
    if (janelas.length === 0) { limitations.push(`não foi possível localizar no texto: ${rotulo}`); return undefined; }
    for (const janela of janelas) {
      const valor = simNaoDeTextoCru(janela);
      if (valor !== undefined) return valor;
    }
    limitations.push(`achou menção a "${rotulo}" mas não deu para classificar sim/não`);
    return undefined;
  };

  const consortiumAllowed = ler(CLAUSULA_CONSORCIO, "se permite consórcio");
  // ⚠️ CAT/CREA/CAU é quase universal em obra pública — a ausência de registro
  // no conselho de classe é rara o bastante para o padrão inverso (só exigir
  // quando NEGADO explicitamente) valer mais do que exigir uma frase de "sim"
  // que o texto raramente repete. É a única das três cláusulas com este viés;
  // as outras duas seguem a régua neutra (sim OU não, nunca um padrão).
  const requiresCat = ler(CLAUSULA_CAT, "exigência de CAT/CREA/CAU") ?? true;
  const requiresSiteVisit = ler(CLAUSULA_VISITA, "exigência de visita técnica");

  return {
    ...(consortiumAllowed !== undefined ? { consortiumAllowed } : {}),
    requiresCat,
    ...(requiresSiteVisit !== undefined ? { requiresSiteVisit } : {}),
    limitations,
  };
}

/**
 * A frase "qualificação técnico-operacional" aparece várias vezes num
 * documento real — inclusive de PASSAGEM, explicando a diferença para a
 * qualificação técnico-PROFISSIONAL (do engenheiro, sem quantitativo mínimo).
 * Só uma ocorrência é o TÍTULO da seção que interessa, e ela sempre vem
 * seguida da citação do artigo e de "atestado" + "empresa" — é a exigência
 * sobre a EMPRESA, não sobre o profissional.
 */
const ANCORA_OPERACIONAL = /qualificacao tecnic[ao][\s-]*operacional/g;
const CONFIRMA_TITULO_SECAO = /atestado[\s\S]{0,120}empresa|empresa[\s\S]{0,120}atestado/;
const ANCORA_SECAO_SEGUINTE = /\bconclusao\b|\bjustificativa\s*:/;

/**
 * O trecho de texto que provavelmente contém as parcelas de maior relevância,
 * ou `undefined` quando nenhuma ocorrência da âncora se confirma como título
 * de seção — mais seguro que devolver a seção errada.
 */
export function extractRelevantServicesSection(textoOriginal: string): string | undefined {
  const alvo = normalizeText(textoOriginal);

  // ⚠️ `normalizeText` COLAPSA espaço múltiplo em um só — comum em texto de
  // PDF extraído. Isso encolhe o texto normalizado em relação ao original, e
  // o encolhimento CRESCE conforme se avança no documento. Um índice certo
  // no texto normalizado cai cada vez mais cedo do que devia no original — a
  // seção real de Pedra Preta cortava faltando os últimos ~5 caracteres da
  // última parcela (o "40%" da linha 6), sem margem nenhuma. A margem abaixo
  // é o remédio: melhor incluir um pouco de sobra da seção seguinte (inofensivo
  // — `parseRelevantServicesTable`, mais abaixo, só reconhece o formato de
  // linha da tabela e ignora o resto) do que perder o fim da que interessa.
  const MARGEM_DESVIO_NORMALIZACAO = 400;

  for (const ancora of alvo.matchAll(ANCORA_OPERACIONAL)) {
    const inicio = ancora.index;
    const depois = alvo.slice(inicio + ancora[0].length, inicio + ancora[0].length + 250);
    if (!CONFIRMA_TITULO_SECAO.test(depois)) continue; // menção de passagem, não o título

    const fimMatch = ANCORA_SECAO_SEGUINTE.exec(alvo.slice(inicio + ancora[0].length + 250));
    const teto = 6_000;
    const fim = fimMatch
      ? Math.min(inicio + ancora[0].length + 250 + fimMatch.index + MARGEM_DESVIO_NORMALIZACAO, inicio + teto)
      : Math.min(textoOriginal.length, inicio + teto);

    const trecho = textoOriginal.slice(inicio, fim).trim();
    if (trecho.length > 0) return trecho;
  }
  return undefined;
}

/**
 * Uma linha da tabela de parcelas é ancorada em "100%" — o percentual ORÇADO
 * é sempre 100% dele mesmo, é uma tautologia da própria tabela, e por isso é
 * o ponto mais confiável para cortar uma linha da seguinte. A descrição pode
 * ter número embutido ("45 CM BASE", "2X2 M") que inviabiliza cortar por
 * dígito; o "100%" não tem esse problema porque não é medida de nada.
 *
 * Depois do "100%" vem a quantidade EXIGIDA — o número que decide habilitação
 * — em ", QUANTIDADE UNIDADE ... PERCENTUAL%". O percentual costuma sair com
 * um espaço solto no meio ("4 0%" em vez de "40%") — artefato de espaçamento
 * do PDF de origem, não erro de digitação; por isso o percentual em si não é
 * usado, só a quantidade que vem antes dele.
 */
const PERCENTUAL_ORCADO = /100\s*%/g;
// ⚠️ Duas armadilhas na unidade:
// 1. "M³"/"M²" mantêm o expoente sobrescrito depois de `normalizeText` — ele
//    não é letra acentuada, então nem NFD nem o strip de diacríticos o tocam.
// 2. "³"/"²" NÃO conta como `\w` para o regex — `\b` logo depois deles nunca
//    fecha (não-palavra seguida de espaço não é fronteira), e o motor
//    backtrackeava para NÃO capturar o expoente, só para a fronteira fechar.
//    Por isso a fronteira é um lookahead explícito por espaço/fim, não `\b`.
const QUANTIDADE_EXIGIDA_APOS = /^\s*([\d.,]+)\s*(m[23²³]?|un|kg|km|ha|l)(?=[\s%]|$)[^%]{0,20}?\d\s?\d{0,2}\s*%/i;

function parseRelevantServicesTable(textoOriginal: string): readonly RequiredService[] {
  const alvo = normalizeText(textoOriginal);
  const services: RequiredService[] = [];
  let finalAnterior = 0;

  for (const casado of alvo.matchAll(PERCENTUAL_ORCADO)) {
    const apos = QUANTIDADE_EXIGIDA_APOS.exec(alvo.slice(casado.index + casado[0].length, casado.index + casado[0].length + 60));
    // Sem a quantidade exigida logo depois, não é uma linha da tabela — é
    // outro "100%" qualquer no meio do texto (percentual de outra coisa).
    if (!apos) continue;

    const descricao = textoOriginal.slice(finalAnterior, casado.index)
      // Cabeçalho de página, e o cabeçalho de coluna da própria tabela: ruído
      // que se repete a cada página e não descreve serviço nenhum.
      .replace(/={5}\s*p[áa]gina\s*\d+\s*={5}/gi, " ")
      .replace(/itens?\s+descri[çc][ãa]o\s+dos\s+servi[çc]os[\s\S]{0,200}?percentual\s+requerido\s+para\s+t[ée]cnico\s+profissional/i, " ")
      .replace(/\s+/g, " ")
      .trim();

    const quantidade = parseQuantidadeUnidade(`${apos[1]} ${apos[2]}`);
    const unidade = normalizeUnit(apos[2]);
    services.push({
      description: descricao.length > 0 ? descricao : "(descrição não identificada)",
      ...(quantidade && unidade ? { quantity: quantidade.value, unit: unidade } : {}),
    });

    finalAnterior = casado.index + casado[0].length + apos[0].length;
  }
  return services;
}

/**
 * Ponto de entrada único: texto extraído de um documento → o mesmo
 * `EditalRequirement` que a leitura por IA produzia.
 *
 * As três cláusulas institucionais usam o classificador próprio deste módulo,
 * porque `parseBoolean` (edital-requirement.ts) foi calibrado para resposta
 * curta da IA, não para o substantivo de texto de lei.
 */
export function editalRequirementFromText(textoOriginal: string): EditalRequirement {
  const secaoServicos = extractRelevantServicesSection(textoOriginal);
  const institucional = extractInstitutionalRequirement(textoOriginal);
  const services = secaoServicos ? parseRelevantServicesTable(secaoServicos) : [];

  const limitations = [
    ...(secaoServicos ? [] : ["não foi possível localizar no texto: a lista de parcelas de maior relevância"]),
    ...(secaoServicos && services.length === 0 ? ["achou a seção de parcelas de maior relevância, mas não reconheceu o formato da tabela"] : []),
    ...institucional.limitations,
  ];

  return {
    services,
    ...(institucional.consortiumAllowed !== undefined ? { consortiumAllowed: institucional.consortiumAllowed } : {}),
    requiresCat: institucional.requiresCat,
    ...(institucional.requiresSiteVisit !== undefined ? { requiresSiteVisit: institucional.requiresSiteVisit } : {}),
    limitations,
  };
}
