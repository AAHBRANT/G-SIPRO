import { normalizeText } from "@/modules/scouting/domain/qualification";
import { descartesDaFila, findDuplicates, type FilaInput } from "@/modules/scouting/domain/duplicates";

/**
 * Plano da limpeza das duplicatas que a aprovação do Buscador deixou no banco
 * até 07/10/2026. Só DECIDE — quem grava é o serviço, e só depois que um
 * usuário mestre confere a prévia e confirma.
 *
 * Duas origens de oportunidade duplicada:
 *
 * 1. a mesma obra publicada mais de uma vez no PNCP e cada publicação
 *    aprovada — cada uma virou sua oportunidade;
 * 2. a MESMA licitação aprovada duas vezes (clique duplo, duas pessoas, ou
 *    falha no meio da aprovação). A última aprovação ficou vinculada à
 *    licitação; as anteriores ficaram órfãs — origem BUSCADOR, nenhuma
 *    licitação apontando para elas, mesmo órgão e mesmo objeto.
 *
 * ⚠️ Encerrar, nunca apagar. Oportunidade tem histórico, ficha, edital e
 * requisitos pendurados; encerrada como "Outro" com a justificativa
 * apontando a que ficou, ela sai das listas de trabalho e continua
 * reabrível pela tela dela se a limpeza tiver errado.
 */

export type OportunidadeParaLimpeza = Readonly<{
  id: string;
  code: string;
  status: "DRAFT" | "QUALIFICATION" | "ACTIVE" | "SUSPENDED" | "CLOSED";
  origin: string;
  subject?: string | undefined;
  contractingAuthorityId?: string | undefined;
  createdAt: Date;
  temProposta: boolean;
  fichas: number;
  /** Alguma licitação rastreada aponta para ela. */
  vinculada: boolean;
}>;

export type LicitacaoParaLimpeza = FilaInput & Readonly<{
  opportunityId?: string | undefined;
}>;

export type GrupoDeOportunidades = Readonly<{
  fica: OportunidadeParaLimpeza;
  /** Encerradas automaticamente na confirmação. */
  encerrar: readonly OportunidadeParaLimpeza[];
  /** Já têm proposta ou avançaram de "Em análise": a equipe decide à mão. */
  manual: readonly OportunidadeParaLimpeza[];
}>;

export type PlanoDeLimpeza = Readonly<{
  /** Pendentes que são a mesma obra de outra licitação (regra da fila). */
  licitacoes: ReadonlyMap<string, Readonly<{ sobrevivente: string; jaAprovada: boolean }>>;
  grupos: readonly GrupoDeOportunidades[];
}>;

const ENCERRAVEIS = new Set<OportunidadeParaLimpeza["status"]>(["DRAFT", "QUALIFICATION"]);
const PESO_DO_STATUS: Record<OportunidadeParaLimpeza["status"], number> = {
  ACTIVE: 3, SUSPENDED: 3, QUALIFICATION: 2, DRAFT: 1, CLOSED: 0,
};

/** Objeto curto demais não distingue nada ("reforma de escola"). */
function chaveDeObjeto(oportunidade: OportunidadeParaLimpeza): string | undefined {
  const objeto = normalizeText(oportunidade.subject ?? "").replace(/\s+/g, " ").trim();
  if (!oportunidade.contractingAuthorityId || objeto.length < 20) return undefined;
  return `${oportunidade.contractingAuthorityId}|${objeto}`;
}

/**
 * Qual fica: a que mais avançou; empatadas, a que tem proposta, depois a que
 * tem ficha, depois a vinculada à licitação, e por fim a mais antiga — é
 * nela que o trabalho começou.
 */
function melhorParaFicar(a: OportunidadeParaLimpeza, b: OportunidadeParaLimpeza): OportunidadeParaLimpeza {
  if (PESO_DO_STATUS[a.status] !== PESO_DO_STATUS[b.status]) return PESO_DO_STATUS[a.status] > PESO_DO_STATUS[b.status] ? a : b;
  if (a.temProposta !== b.temProposta) return a.temProposta ? a : b;
  if ((a.fichas > 0) !== (b.fichas > 0)) return a.fichas > 0 ? a : b;
  if (a.vinculada !== b.vinculada) return a.vinculada ? a : b;
  return a.createdAt <= b.createdAt ? a : b;
}

export function planejarLimpeza(
  licitacoes: readonly LicitacaoParaLimpeza[],
  oportunidades: readonly OportunidadeParaLimpeza[],
): PlanoDeLimpeza {
  // Encerrada já saiu das listas de trabalho: não conta nem como sobrevivente.
  const abertas = new Map(oportunidades.filter((o) => o.status !== "CLOSED").map((o) => [o.id, o]));

  const pai = new Map<string, string>();
  const achar = (id: string): string => {
    let raiz = id;
    while (pai.has(raiz) && pai.get(raiz) !== raiz) raiz = pai.get(raiz)!;
    pai.set(id, raiz);
    return raiz;
  };
  const unir = (a: string, b: string) => {
    if (!abertas.has(a) || !abertas.has(b)) return;
    const ra = achar(a);
    const rb = achar(b);
    if (ra !== rb) pai.set(ra, rb);
  };

  // 1. Publicações diferentes da mesma obra, cada uma aprovada.
  const aprovadas = licitacoes.filter((l) => l.aprovada && l.opportunityId);
  const oportunidadeDaLicitacao = new Map(aprovadas.map((l) => [l.id, l.opportunityId!]));
  for (const [id, irmas] of findDuplicates(aprovadas)) {
    for (const irma of irmas) unir(oportunidadeDaLicitacao.get(id)!, oportunidadeDaLicitacao.get(irma)!);
  }

  // 2. A mesma licitação aprovada mais de uma vez: órfã do Buscador com o
  //    mesmo órgão e o mesmo objeto de uma oportunidade do Buscador.
  const doBuscador = [...abertas.values()].filter((o) => o.origin === "BUSCADOR");
  const porChave = new Map<string, string[]>();
  for (const oportunidade of doBuscador) {
    const chave = chaveDeObjeto(oportunidade);
    if (!chave) continue;
    porChave.set(chave, [...(porChave.get(chave) ?? []), oportunidade.id]);
  }
  for (const ids of porChave.values()) {
    const temOrfa = ids.some((id) => !abertas.get(id)!.vinculada);
    if (!temOrfa) continue;
    // Só une através de órfã: duas vinculadas com o mesmo texto já foram
    // tratadas (ou deliberadamente não) pelo passo 1, que olha o processo.
    for (const id of ids) {
      if (!abertas.get(id)!.vinculada) for (const outro of ids) if (outro !== id) unir(id, outro);
    }
  }

  const porRaiz = new Map<string, OportunidadeParaLimpeza[]>();
  for (const id of pai.keys()) {
    const raiz = achar(id);
    porRaiz.set(raiz, [...(porRaiz.get(raiz) ?? []), abertas.get(id)!]);
  }

  const grupos: GrupoDeOportunidades[] = [];
  for (const membros of porRaiz.values()) {
    const unicos = [...new Map(membros.map((m) => [m.id, m])).values()];
    if (unicos.length < 2) continue;
    const fica = unicos.reduce(melhorParaFicar);
    const outras = unicos.filter((m) => m.id !== fica.id).sort((a, b) => a.code.localeCompare(b.code));
    grupos.push({
      fica,
      encerrar: outras.filter((m) => ENCERRAVEIS.has(m.status) && !m.temProposta),
      manual: outras.filter((m) => !ENCERRAVEIS.has(m.status) || m.temProposta),
    });
  }
  grupos.sort((a, b) => a.fica.code.localeCompare(b.fica.code));

  return { licitacoes: descartesDaFila(licitacoes), grupos };
}
