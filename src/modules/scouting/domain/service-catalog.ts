import { normalizeText } from "@/modules/scouting/domain/qualification";

/**
 * Catálogo de serviços de obra.
 *
 * Existe porque tipo de obra é grosso demais para responder à pergunta que
 * decide a disputa. "Pavimentação" só diz sim ou não; o que a equipe precisa
 * saber é QUAIS serviços o objeto exige e QUAIS delas o acervo comprova — a
 * diferença entre os dois é o que se busca num parceiro de consórcio.
 *
 * O mesmo vocabulário lê os dois lados: o objeto da licitação e a disciplina e
 * descrição de cada serviço do acervo. Ler com a mesma régua é o que torna a
 * comparação honesta.
 *
 * ⚠️ Este catálogo é uma aproximação da nomenclatura usada em atestado. Ele vai
 * errar para menos — serviço que existe no acervo com outro nome aparece como
 * não coberto. `scripts/diagnosticar-acervo.mts` lista as disciplinas do acervo
 * que nenhuma categoria reconheceu; é essa lista que corrige o catálogo com
 * dado real, e não palpite.
 */

export type ServiceCategory = Readonly<{
  id: string;
  label: string;
  /** Termos já normalizados: sem acento, minúsculos, sem o marcador de radical. */
  terms: readonly string[];
  /** Compilados uma vez: `categoriesIn` roda sobre a fila inteira. */
  patterns: readonly RegExp[];
}>;

/**
 * Marcador de RADICAL. `"fundac*"` casa fundação, fundações, fundacoes.
 * Sem ele, o termo é palavra inteira e só casa como palavra.
 *
 * ⚠️ A distinção não é preciosismo — é o conserto de um defeito medido. O
 * casamento era por substring pura, e isso creditava categoria errada o tempo
 * todo: "eta" casava dentro de concretagem, sarjeta, canaleta e etapa, então
 * QUASE TODO texto de obra ganhava acervo de estação de tratamento; "estaca"
 * casava dentro de subestação; "poste" dentro de posteriormente; "canal"
 * dentro de canaleta. Sempre para MAIS cobertura — o erro que faz a equipe
 * montar proposta e ser inabilitada.
 */
const RADICAL = "*";

/**
 * Marcador de EXCEÇÃO, só combina com radical: `"asfalt*!manta"` casa
 * "asfalt" em qualquer flexão — pavimentação asfáltica, mistura asfáltica,
 * camada asfáltica — MENOS quando a palavra logo antes é "manta". "Manta
 * asfáltica" é impermeabilização de laje, não pavimento, e essa distinção não
 * dá para escrever como termo positivo sem enumerar à mão toda variação real
 * de "asfált-" como adjetivo — e ainda assim perder a próxima que ninguém
 * pensou. Achado no diagnóstico do catálogo em produção, 03/09/2026.
 */
const EXCETO = "!";

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Separa o corpo do termo (radical incluso) da palavra de exceção, quando
 * houver. Um termo sem "!" devolve `excecao: undefined`.
 */
function partes(termo: string): { corpo: string; excecao?: string } {
  const [corpo, excecao] = termo.split(EXCETO);
  return { corpo: corpo ?? termo, ...(excecao ? { excecao } : {}) };
}

/**
 * Fronteira à esquerda sempre. À direita, só para palavra inteira — o radical
 * precisa aceitar a flexão que vem depois dele.
 */
/** Aceita o plural comum e o de -ão: poço/poços, escavação/escavações. */
const comPlural = (palavra: string) => {
  const corpo = palavra.endsWith("ao")
    ? `(?:${escapar(palavra)}|${escapar(palavra.slice(0, -2))}oes)`
    : escapar(palavra);
  return `${corpo}(?:s|es)?`;
};

function expressao(termo: string): RegExp {
  const { corpo, excecao } = partes(termo);
  const radical = corpo.endsWith(RADICAL);
  const base = normalizeText(radical ? corpo.slice(0, -1) : corpo);
  const inicio = "(?:^|[^a-z0-9])";
  if (radical) {
    // A exceção fica DEPOIS da fronteira e ANTES do radical: ela precisa
    // olhar a palavra imediatamente anterior ao "asfalt", não o caractere de
    // fronteira que a antecede.
    const naoApos = excecao ? `(?<!${escapar(normalizeText(excecao))}\\s)` : "";
    return new RegExp(`${inicio}${naoApos}${escapar(base)}`);
  }
  // Cada palavra flexiona: "poço tubular" tem de casar "poços tubulares".
  // Pluralizar só o fim deixaria o termo composto de fora.
  const corpoRegex = base.split(/\s+/).map(comPlural).join("\\s+");
  return new RegExp(`${inicio}${corpoRegex}(?:[^a-z0-9]|$)`);
}

const categoria = (id: string, label: string, terms: readonly string[]): ServiceCategory => ({
  id,
  label,
  terms: terms.map((term) => {
    const { corpo } = partes(term);
    return normalizeText(corpo.endsWith(RADICAL) ? corpo.slice(0, -1) : corpo);
  }),
  patterns: terms.map(expressao),
});

export const serviceCatalog: readonly ServiceCategory[] = [
  // ⚠️ "retaludament*" e "movimento de terra" somam-se aos termos já existentes
  // ("movimentacao de terra", com -ção, é palavra diferente de "movimento", sem
  // -ção — nenhum dos dois pluraliza no outro).
  categoria("terraplenagem", "Terraplenagem", ["terraplen*", "terraplan*", "movimentacao de terra", "movimento de terra", "retaludament*", "escavacao", "aterro", "corte e aterro", "desmonte"]),
  categoria("pavimento-asfaltico", "Pavimento asfáltico", ["cbuq", "caup", "concreto betuminoso", "asfalt*!manta", "recapea*", "imprimacao", "pintura de ligacao", "micro revestimento", "tratamento superficial"]),
  categoria("pavimento-rigido", "Pavimento rígido e calçamento", ["pavimento de concreto", "piso intertravado", "paralelepipedo", "calcament*", "pedra portuguesa", "bloquete"]),
  categoria("base-sub-base", "Base e sub-base", ["base e sub-base", "sub-base", "sub base", "brita graduada", "solo brita", "regularizacao do subleito", "reforco do subleito"]),
  // "poco de visita" achado no diagnóstico: é o poço de inspeção da rede
  // coletora — a mesma peça que aparece nas parcelas de maior relevância de
  // edital de drenagem (visto no caso real de Pedra Preta/MT).
  categoria("drenagem", "Drenagem", ["drenagem", "bueiro", "galeria de aguas pluviais", "sarjeta", "meio-fio", "meio fio", "boca de lobo", "canaleta", "poco de visita"]),
  categoria("canalizacao", "Canalização e macrodrenagem", ["canalizac*", "macrodrenagem", "retificacao de corrego", "curso d agua", "canal"]),
  categoria("obra-de-arte", "Obra de arte especial", ["ponte", "viaduto", "passarela", "tunel", "obra de arte especial", "concreto protendido", "aduela"]),
  // "rebaixamento do lencol freatico" é serviço auxiliar de fundação em terreno
  // encharcado — achado no diagnóstico de 03/09/2026.
  categoria("fundacao", "Fundação", ["fundac*", "estaca", "microestaca", "tubulao", "sapata", "bloco de coroamento", "radier", "rebaixamento do lencol freatico"]),
  categoria("estrutura-concreto", "Estrutura de concreto", ["estrutura de concreto", "concreto armado", "pilar", "viga", "laje", "forma e armacao"]),
  categoria("estrutura-metalica", "Estrutura metálica e cobertura", ["estrutura metalica", "cobertura", "telhamento", "trelica", "galpao metalico"]),
  // "muro de flexao"/"cortina de flexao" e "barragem"/"enrocamento"/
  // "vertedouro" achados no diagnóstico de 03/09/2026: enrocamento (pedra
  // lançada) é a mesma técnica de contenção do gabião, só que sem a tela
  // metálica — e a barragem que o acervo registrou usa exatamente essa técnica.
  categoria("contencao", "Contenção", ["contenc*", "muro de arrimo", "muro de flexao", "cortina de flexao", "talude", "gabiao", "cortina atirantada", "solo grampeado", "barragem", "enrocamento", "vertedouro"]),
  categoria("alvenaria", "Alvenaria e vedação", ["alvenaria", "vedacao", "bloco ceramico", "chapisco", "reboco", "emboco"]),
  // ⚠️ "acabamento" (a palavra que dá nome à própria categoria) NÃO estava na
  // lista de termos — achado no diagnóstico de 03/09/2026, responsável sozinho
  // por boa parte dos ~58 serviços rotulados "CASA 01/02/03 .../ACABAMENTO".
  categoria("acabamento", "Acabamento", ["acabamento", "revestimento ceramico", "pintura", "gesso", "forro", "piso vinilico", "esquadria", "porcelanato"]),
  categoria("impermeabilizacao", "Impermeabilização", ["impermeabiliz*", "manta asfaltica"]),
  // ⚠️⚠️ NÃO usar "eletric*"/"hidraulic*" como radical solto aqui. Foi tentado
  // em 03/09/2026 para pegar "Elétrica"/"Hidráulica" sozinhas no ACERVO — e
  // funcionou para isso — mas `categoriesIn` lê os DOIS lados com a mesma
  // régua (é o próprio design: "comparar dois lados lidos por réguas
  // diferentes produziria diferença que é do vocabulário, não da realidade").
  // No lado da EXIGÊNCIA, o objeto da licitação quase sempre cita "rede
  // elétrica e hidráulica" de passagem, como parte de qualquer obra civil — e
  // aí essas viravam pré-requisito OBRIGATÓRIO contra as DUAS categorias com
  // menos acervo de todo o catálogo (19 e 9 serviços). Resultado: a aderência
  // de virtualmente toda licitação de infraestrutura despencou para ~38%, em
  // produção. Revertido no mesmo dia. Se um dia isto voltar a ser tentado,
  // tem de ser separando o vocabulário do objeto do vocabulário do acervo —
  // não alargando os dois juntos.
  categoria("instalacoes-eletricas", "Instalações elétricas", ["instalacoes eletricas", "instalacao eletrica", "cabeamento", "subestacao", "quadro de distribuicao", "spda"]),
  // "hidrossanitario" (uma palavra) e "hidro-sanitario" (com hífen) são a
  // MESMA coisa escrita de duas formas — o radical original só cobria a
  // primeira; o hífen não é removido por `normalizeText`. Estes dois, ao
  // contrário do "hidraulic*" acima, exigem "hidro" E "sanitar" juntos, o que
  // não aparece como menção de passagem num objeto genérico.
  categoria("instalacoes-hidraulicas", "Instalações hidráulicas", ["instalacoes hidraulicas", "instalacao hidraulica", "hidrossanitar*", "hidro-sanitar*", "hidro sanitar*", "agua fria", "agua quente"]),
  categoria("climatizacao", "Climatização e exaustão", ["climatizac*", "ar condicionado", "exaustao", "hvac"]),
  categoria("rede-agua", "Rede de água e adutora", ["adutor*", "rede de agua", "abastecimento de agua", "reservatorio", "elevatoria de agua", "booster"]),
  categoria("rede-esgoto", "Rede de esgoto", ["rede de esgoto", "esgotamento sanitario", "coletor tronco", "interceptor", "elevatoria de esgoto"]),
  categoria("tratamento", "Estação de tratamento", ["estacao de tratamento", "eta", "ete", "tratamento de efluente"]),
  categoria("poco", "Poço tubular", ["poco tubular", "poco artesiano", "perfuracao de poco"]),
  // "urbanismo" achado no diagnóstico: "urbanizac*" (com -ização) não pluraliza
  // "urbanismo" (com -ismo) — são sufixos diferentes da mesma raiz.
  categoria("urbanizacao", "Urbanização e paisagismo", ["urbanizac*", "urbanismo", "paisagismo", "praca", "calcadao", "orla", "requalificacao urbana", "mobiliario urbano", "arborizacao"]),
  categoria("sinalizacao", "Sinalização viária", ["sinalizacao viaria", "sinalizacao horizontal", "sinalizacao vertical", "pintura de faixa", "tachao", "defensa metalica"]),
  categoria("iluminacao", "Iluminação pública", ["iluminacao publica", "poste", "luminaria"]),
  categoria("demolicao", "Demolição e remoção", ["demolic*", "remocao", "desmobilizacao", "limpeza do terreno"]),
  categoria("reforma", "Reforma e retrofit", ["reforma", "retrofit", "readequac*", "restauracao", "recuperacao estrutural", "ampliacao"]),
  categoria("edificacao", "Edificação", ["edificac*", "edificio", "predio", "escola", "creche", "hospital", "posto de saude", "ginasio", "quadra poliesportiva", "unidade basica"]),
];

const porId = new Map(serviceCatalog.map((c) => [c.id, c]));
export const categoryById = (id: string): ServiceCategory | undefined => porId.get(id);

/**
 * Categorias reconhecidas num texto livre.
 *
 * Serve tanto para o objeto da licitação quanto para a disciplina e descrição
 * de um serviço do acervo — de propósito: comparar dois lados lidos por réguas
 * diferentes produziria diferença que é do vocabulário, não da realidade.
 */
export function categoriesIn(text: string): readonly ServiceCategory[] {
  const alvo = normalizeText(text);
  return serviceCatalog.filter((categoria) => categoria.patterns.some((padrao) => padrao.test(alvo)));
}
