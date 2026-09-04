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
 * Minúsculas + sem acento, SEM colapsar espaço — ao contrário de `normalizeText`
 * (qualification.ts), que colapsa espaço múltiplo em um só. Aqui a posição de
 * um casado precisa corresponder 1:1 ao índice do TEXTO ORIGINAL, porque é ela
 * que decide onde cortar `textoOriginal` mais abaixo. Um edital real de 261 mil
 * caracteres (Santa Cruz do Sul/RS), com espaçamento de coluna do PDF (3+
 * espaços seguidos entre palavras, o padrão inteiro do documento), tinha a
 * seção inteira errada cortada — o casado em texto colapsado caía dezenas de
 * milhares de posições antes de onde o mesmo trecho está no original, porque o
 * colapso encolhe o texto e o encolhimento cresce por todo o documento. Textos
 * curtos (as fixtures de teste) não têm espaçamento repetido o bastante pra
 * doer, por isso o bug não aparecia nelas.
 */
const MARCA_DIACRITICO_INICIO = String.fromCharCode(0x0300);
const MARCA_DIACRITICO_FIM = String.fromCharCode(0x036f);
const REGEX_MARCA_DIACRITICO = new RegExp(`[${MARCA_DIACRITICO_INICIO}-${MARCA_DIACRITICO_FIM}]`, "g");

function normalizeIndicePreservado(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(REGEX_MARCA_DIACRITICO, "");
}

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
 *
 * ⚠️ "Vedada a substituição [de X por Y]" é removida ANTES de tudo — achado
 * testando o edital real de Camaquá/RS: a cláusula de CAT/CREA vinha seguida,
 * na mesma janela, de "Vedada a substituição por [outro documento]", e o
 * "vedad" dessa frase (sobre TROCAR o documento) virava "CAT não exigido" por
 * engano — a vedação aqui nega a substituição, nunca a exigência que a
 * antecede. Sem isto, uma cláusula clássica de contrato público (comum,
 * sem relação nenhuma com o gatilho que a janela veio buscar) sacava o "falso"
 * errado antes de qualquer chance de o texto certo classificar.
 */
function simNaoDeTextoCru(texto: string): boolean | undefined {
  const alvo = normalizeText(texto).replace(/vedad\w*\s+a\s+substituic\w*[^.;]*/g, "");
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
function todasAsJanelas(textoOriginal: string, textoIndicePreservado: string, gatilhos: readonly RegExp[]): readonly string[] {
  const janelas: string[] = [];
  for (const gatilho of gatilhos) {
    for (const casado of textoIndicePreservado.matchAll(new RegExp(gatilho, "g"))) {
      const inicio = Math.max(0, casado.index - 40);
      const fim = Math.min(textoOriginal.length, casado.index + JANELA_CLAUSULA);
      janelas.push(textoOriginal.slice(inicio, fim));
    }
  }
  return janelas;
}

const CLAUSULA_CONSORCIO: readonly RegExp[] = [/consorcio/];
const CLAUSULA_CAT: readonly RegExp[] = [/\bcat\b|atestado\s+de\s+(responsabilidade|capacidade)\s+tecnica|\bcrea\b|\bcau\b/];
const CLAUSULA_VISITA: readonly RegExp[] = [/visita\s+tecnica|vistoria\s+tecnica/];

/**
 * Só o consórcio tem esta segunda tentativa: em edital real, a vedação às
 * vezes não repete o verbo perto do item — vem UMA VEZ, no cabeçalho de uma
 * lista numerada de impedidos de disputar/participar (Lei 14.133, art. 14), e
 * "consórcio" aparece bem depois só como mais uma linha da lista, sem repetir
 * "vedado" por perto. Achado testando o edital real de Santa Cruz do Sul/RS:
 * "3.8 - Não poderão disputar esta licitação: ... 3.8.9 - pessoas jurídicas
 * reunidas em consórcio;" — ~2.900 caracteres depois do cabeçalho que a proíbe,
 * bem além da janela estreita de `todasAsJanelas`.
 */
const CABECALHO_IMPEDIMENTO_PARTICIPACAO = /nao\s+poder(?:a|ao)\s+(?:disputar|participar)|impedidos?\s+de\s+(?:disputar|participar)|vedada\s+a\s+participac/;
const JANELA_CABECALHO_IMPEDIMENTO = 3_500;

/**
 * "Empresa, isoladamente ou em consórcio, responsável pela elaboração do
 * projeto..." NÃO é vedação a consórcio — é a exclusão, bem mais comum (Lei
 * 14.133, art. 14), do AUTOR DO PROJETO por conflito de interesse, que só
 * cita "consórcio" pra dizer que o impedimento vale nas duas formas de
 * organização. Achado testando o edital real de Camaquá/RS: as DUAS únicas
 * ocorrências de "consórcio" no documento eram desta cláusula — sem este
 * filtro, o cabeçalho "não poderá disputar" (que ali governa a lista de
 * conflito de interesse, não uma vedação de consórcio) fazia o fallback dizer
 * "vedado" quando o documento não fala nada sobre consórcio em si.
 */
const CONSORCIO_E_QUALIFICADOR_DE_OUTRA_EXCLUSAO = /elaboracao\s+do\s+projeto|autor\s+do\s+projeto|projeto\s+basico|projeto\s+executivo/;

function resolveConsorcio(textoOriginal: string, alvo: string, limitations: string[]): boolean | undefined {
  const rotulo = "se permite consórcio";
  const janelas = todasAsJanelas(textoOriginal, alvo, CLAUSULA_CONSORCIO);
  if (janelas.length === 0) { limitations.push(`não foi possível localizar no texto: ${rotulo}`); return undefined; }
  for (const janela of janelas) {
    const valor = simNaoDeTextoCru(janela);
    if (valor !== undefined) return valor;
  }
  for (const ancora of alvo.matchAll(new RegExp(CLAUSULA_CONSORCIO[0]!, "g"))) {
    const contextoImediato = alvo.slice(Math.max(0, ancora.index - 40), ancora.index + JANELA_CLAUSULA);
    if (CONSORCIO_E_QUALIFICADOR_DE_OUTRA_EXCLUSAO.test(contextoImediato)) continue;
    const desde = Math.max(0, ancora.index - JANELA_CABECALHO_IMPEDIMENTO);
    if (CABECALHO_IMPEDIMENTO_PARTICIPACAO.test(alvo.slice(desde, ancora.index))) return false;
  }
  limitations.push(`achou menção a "${rotulo}" mas não deu para classificar sim/não`);
  return undefined;
}

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
  const alvo = normalizeIndicePreservado(textoOriginal);
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

  const consortiumAllowed = resolveConsorcio(textoOriginal, alvo, limitations);
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
 * DUAS âncoras, porque dois municípios reais nomeiam a mesma exigência de
 * jeitos que não se sobrepõem:
 *  - "Parcela(s) de maior relevância técnica ou valor significativo" é a
 *    expressão da PRÓPRIA LEI (14.133/2021, art. 67, §1º) — Santa Cruz do
 *    Sul/RS usa essa frase quase literal.
 *  - Pedra Preta/MT NUNCA usa essa frase; organiza a mesma exigência sob o
 *    título "d) Qualificação Técnico-Operacional", sem citar a lei ipsis
 *    litteris. Um município não tem o vocabulário do outro.
 *
 * ⚠️ Qualquer uma das duas aparece MAIS DE UMA VEZ no mesmo documento pelo
 * mesmo motivo: a qualificação técnico-PROFISSIONAL (do engenheiro, sem
 * quantitativo mínimo) cita a mesma lista de parcelas, sem número nenhum,
 * antes da qualificação técnico-OPERACIONAL (da empresa, com quantitativo) a
 * repetir. Não dá para escolher pelo título da seção nem por qual âncora
 * casou — escolhe-se pela ocorrência cujo texto seguinte tem mais NÚMERO com
 * jeito de quantitativo, em qualquer formato (tabela ou lista): é o
 * quantitativo mínimo que só a exigência da empresa carrega.
 */
const ANCORAS_PARCELAS: readonly RegExp[] = [
  /parcelas?\s+de\s+maior\s+relev[aâ]ncia/g,
  /qualificacao\s+tecnic[ao][\s-]*operacional/g,
];
const ANCORA_SECAO_SEGUINTE = /\bconclusao\b|\bjustificativa\s*:|\b[a-z]\.\d\)|8\.2\.\d/;

/** Quantos números com jeito de quantitativo aparecem na janela — o sinal de
 *  que esta ocorrência, e não a outra, é a que importa. */
function contarQuantitativos(texto: string): number {
  return [...texto.matchAll(/\b\d[\d.,]*\s*(m[23²³]?|un|kg|km|ha)\b/g)].length;
}

/**
 * O trecho de texto que provavelmente contém as parcelas de maior relevância,
 * ou `undefined` quando a frase-âncora não aparece no documento.
 */
export function extractRelevantServicesSection(textoOriginal: string): string | undefined {
  // `normalizeIndicePreservado`, não `normalizeText`: o índice do casado aqui
  // decide onde CORTAR `textoOriginal` logo abaixo, e só pode fazer isso
  // corretamente se preservar 1:1 o índice do original — `normalizeText`
  // colapsa espaço múltiplo e desloca a posição (ver comentário da função).
  const alvo = normalizeIndicePreservado(textoOriginal);

  // Folga pequena além do fim detectado: o ponto de corte da seção seguinte é
  // aproximado (título nem sempre começa exatamente onde o regex casa), e um
  // pouco de sobra é inofensivo — os parsers de linha, mais abaixo, só
  // reconhecem o próprio formato e ignoram o resto.
  const FOLGA_FIM_SECAO = 100;
  const JANELA_PONTUACAO = 2_000;
  const teto = 6_000;

  type Candidata = { inicio: number; fim: number; pontuacao: number };
  const candidatas: Candidata[] = [];

  for (const ancoraRegex of ANCORAS_PARCELAS) {
    for (const ancora of alvo.matchAll(ancoraRegex)) {
      const inicio = ancora.index;
      const fimMatch = ANCORA_SECAO_SEGUINTE.exec(alvo.slice(inicio + ancora[0].length));
      const fim = fimMatch
        ? Math.min(inicio + ancora[0].length + fimMatch.index + FOLGA_FIM_SECAO, inicio + teto)
        : Math.min(alvo.length, inicio + teto);
      const pontuacao = contarQuantitativos(alvo.slice(inicio, Math.min(inicio + JANELA_PONTUACAO, fim)));
      candidatas.push({ inicio, fim, pontuacao });
    }
  }

  // Pontuação zero não é candidata real — é menção de passagem (parênteses
  // explicando outra seção, citação da lei sem tabela nenhuma depois), como
  // "...(o que seria tratado na qualificação técnico-operacional)." Sem isto,
  // qualquer ocorrência do termo vira "seção achada" mesmo sem uma linha de
  // quantitativo por perto — voltando a confundir passagem com título.
  const comQuantitativo = candidatas.filter((c) => c.pontuacao > 0);
  if (comQuantitativo.length === 0) return undefined;
  // A de mais quantitativo por perto vence; empate resolve pela ÚLTIMA — a
  // profissional vem antes da operacional nas duas leis (8.666 e 14.133).
  comQuantitativo.sort((a, b) => b.pontuacao - a.pontuacao || b.inicio - a.inicio);
  const melhor = comQuantitativo[0]!;

  const trecho = textoOriginal.slice(melhor.inicio, Math.min(melhor.fim, textoOriginal.length)).trim();
  return trecho.length > 0 ? trecho : undefined;
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
// 1. "M³"/"M²" mantêm o expoente sobrescrito depois de normalizado — ele não é
//    letra acentuada, então nem NFD nem o strip de diacríticos o tocam.
// 2. "³"/"²" NÃO conta como `\w` para o regex — `\b` logo depois deles nunca
//    fecha (não-palavra seguida de espaço não é fronteira), e o motor
//    backtrackeava para NÃO capturar o expoente, só para a fronteira fechar.
//    Por isso a fronteira é um lookahead explícito por espaço/fim, não `\b`.
const QUANTIDADE_EXIGIDA_APOS = /^\s*([\d.,]+)\s*(m[23²³]?|un|kg|km|ha|l)(?=[\s%]|$)[^%]{0,20}?\d\s?\d{0,2}\s*%/i;

function parseRelevantServicesTable(textoOriginal: string): readonly RequiredService[] {
  // `normalizeIndicePreservado`, não `normalizeText`: `casado.index` corta
  // `textoOriginal` logo abaixo (na descrição), e precisa do índice 1:1.
  const alvo = normalizeIndicePreservado(textoOriginal);
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
 * A mesma exigência, em formato de LISTA com marcador em vez de tabela —
 * achado testando contra o edital real de Santa Cruz do Sul/RS: "•
 * Execução de Pavimentação com Bloco Intertravado de no mínimo 656,95m²".
 *
 * Aqui a quantidade e a unidade vêm GRUDADAS, sem espaço ("656,95m²") — ao
 * contrário do "4 0%" com espaço solto de Pedra Preta. Os dois formatos são
 * artefatos de fontes/geradores de PDF diferentes, não erro de digitação; o
 * padrão de unidade já aceita os dois porque o `\s*` entre número e unidade é
 * zero-ou-mais.
 *
 * ⚠️ Mesma armadilha do "³"/"²" já vista em `QUANTIDADE_EXIGIDA_APOS`: um
 * `\b` logo após o expoente opcional não fecha (não-palavra seguida de ";" ou
 * "." também não é fronteira), e o motor sacrifica o expoente pra fechar a
 * fronteira em "m" mesmo — "656,95m²;" virava unidade "m", não "m2". Por isso
 * a fronteira aqui também é um lookahead explícito, não `\b`.
 */
const PARCELA_EM_LISTA = /•\s*([^•]+?)\s*(?:no\s+)?m[ií]nimo\s+(?:de\s+)?([\d.,]+)\s*(m[23²³]?|un|kg|km|ha|l)(?=[\s;.,)]|$)/gi;

function parseRelevantServicesBulletList(textoOriginal: string): readonly RequiredService[] {
  const services: RequiredService[] = [];
  for (const casado of textoOriginal.matchAll(PARCELA_EM_LISTA)) {
    const descricao = casado[1]!.replace(/\s+/g, " ").replace(/[,;:]\s*$/, "").trim();
    const quantidade = parseQuantidadeUnidade(`${casado[2]} ${casado[3]}`);
    const unidade = normalizeUnit(casado[3]);
    services.push({
      description: descricao.length > 0 ? descricao : "(descrição não identificada)",
      ...(quantidade && unidade ? { quantity: quantidade.value, unit: unidade } : {}),
    });
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
 *
 * As parcelas tentam DOIS formatos — tabela (Pedra Preta/MT) e lista com
 * marcador (Santa Cruz do Sul/RS) — porque cada município organiza a mesma
 * exigência da lei à sua moda, e nenhum dos dois foi hipotético: os dois
 * saíram de editais publicados de verdade, testados um contra o outro para
 * o método não regredir ao resolver o segundo.
 */
export function editalRequirementFromText(textoOriginal: string): EditalRequirement {
  const secaoServicos = extractRelevantServicesSection(textoOriginal);
  const institucional = extractInstitutionalRequirement(textoOriginal);
  const daTabela = secaoServicos ? parseRelevantServicesTable(secaoServicos) : [];
  const services = daTabela.length > 0 ? daTabela : (secaoServicos ? parseRelevantServicesBulletList(secaoServicos) : []);

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
