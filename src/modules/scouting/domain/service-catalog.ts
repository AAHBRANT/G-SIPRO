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
  /** Termos já normalizados: sem acento, minúsculos. */
  terms: readonly string[];
}>;

const categoria = (id: string, label: string, terms: readonly string[]): ServiceCategory =>
  ({ id, label, terms: terms.map((term) => normalizeText(term)) });

export const serviceCatalog: readonly ServiceCategory[] = [
  categoria("terraplenagem", "Terraplenagem", ["terraplen", "terraplan", "movimentacao de terra", "escavacao", "aterro", "corte e aterro", "desmonte"]),
  categoria("pavimento-asfaltico", "Pavimento asfáltico", ["cbuq", "concreto betuminoso", "asfalt", "recapea", "imprimacao", "pintura de ligacao", "micro revestimento", "tratamento superficial"]),
  categoria("pavimento-rigido", "Pavimento rígido e calçamento", ["pavimento de concreto", "piso intertravado", "paralelepipedo", "calcament", "pedra portuguesa", "bloquete"]),
  categoria("base-sub-base", "Base e sub-base", ["base e sub-base", "sub-base", "sub base", "brita graduada", "solo brita", "regularizacao do subleito", "reforco do subleito"]),
  categoria("drenagem", "Drenagem", ["drenagem", "bueiro", "galeria de aguas pluviais", "sarjeta", "meio-fio", "meio fio", "boca de lobo", "canaleta"]),
  categoria("canalizacao", "Canalização e macrodrenagem", ["canalizac", "macrodrenagem", "retificacao de corrego", "curso d agua", "canal"]),
  categoria("obra-de-arte", "Obra de arte especial", ["ponte", "viaduto", "passarela", "tunel", "obra de arte especial", "concreto protendido", "aduela"]),
  categoria("fundacao", "Fundação", ["fundac", "estaca", "tubulao", "sapata", "bloco de coroamento", "radier"]),
  categoria("estrutura-concreto", "Estrutura de concreto", ["estrutura de concreto", "concreto armado", "pilar", "viga", "laje", "forma e armacao"]),
  categoria("estrutura-metalica", "Estrutura metálica e cobertura", ["estrutura metalica", "cobertura", "telhamento", "trelica", "galpao metalico"]),
  categoria("contencao", "Contenção", ["contenc", "muro de arrimo", "talude", "gabiao", "cortina atirantada", "solo grampeado"]),
  categoria("alvenaria", "Alvenaria e vedação", ["alvenaria", "vedacao", "bloco ceramico", "chapisco", "reboco", "emboco"]),
  categoria("acabamento", "Acabamento", ["revestimento ceramico", "pintura", "gesso", "forro", "piso vinilico", "esquadria", "porcelanato"]),
  categoria("impermeabilizacao", "Impermeabilização", ["impermeabiliz", "manta asfaltica"]),
  categoria("instalacoes-eletricas", "Instalações elétricas", ["instalacoes eletricas", "instalacao eletrica", "cabeamento", "subestacao", "quadro de distribuicao", "spda"]),
  categoria("instalacoes-hidraulicas", "Instalações hidráulicas", ["instalacoes hidraulicas", "instalacao hidraulica", "hidrossanitar", "agua fria", "agua quente"]),
  categoria("climatizacao", "Climatização e exaustão", ["climatizac", "ar condicionado", "exaustao", "hvac"]),
  categoria("rede-agua", "Rede de água e adutora", ["adutor", "rede de agua", "abastecimento de agua", "reservatorio", "elevatoria de agua", "booster"]),
  categoria("rede-esgoto", "Rede de esgoto", ["rede de esgoto", "esgotamento sanitario", "coletor tronco", "interceptor", "elevatoria de esgoto"]),
  categoria("tratamento", "Estação de tratamento", ["estacao de tratamento", "eta", "ete", "tratamento de efluente"]),
  categoria("poco", "Poço tubular", ["poco tubular", "poco artesiano", "perfuracao de poco"]),
  categoria("urbanizacao", "Urbanização e paisagismo", ["urbanizac", "paisagismo", "praca", "calcadao", "orla", "requalificacao urbana", "mobiliario urbano", "arborizacao"]),
  categoria("sinalizacao", "Sinalização viária", ["sinalizacao viaria", "sinalizacao horizontal", "sinalizacao vertical", "pintura de faixa", "tachao", "defensa metalica"]),
  categoria("iluminacao", "Iluminação pública", ["iluminacao publica", "poste", "luminaria"]),
  categoria("demolicao", "Demolição e remoção", ["demolic", "remocao", "desmobilizacao", "limpeza do terreno"]),
  categoria("reforma", "Reforma e retrofit", ["reforma", "retrofit", "readequac", "restauracao", "recuperacao estrutural", "ampliacao"]),
  categoria("edificacao", "Edificação", ["edificac", "edificio", "predio", "escola", "creche", "hospital", "posto de saude", "ginasio", "quadra poliesportiva", "unidade basica"]),
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
  return serviceCatalog.filter((categoria) => categoria.terms.some((termo) => alvo.includes(termo)));
}
