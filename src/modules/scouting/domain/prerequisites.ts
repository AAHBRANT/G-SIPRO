import type { ArchiveAdherence } from "@/modules/scouting/domain/archive-adherence";
import type { EditalRequirement } from "@/modules/scouting/domain/edital-requirement";

/**
 * Lista de pré-requisitos de uma licitação, para a pessoa decidir sem sair da
 * fila.
 *
 * A regra que organiza tudo aqui: cada item diz DE ONDE veio a resposta. O que o
 * sistema conferiu sozinho aparece resolvido; o que só o edital responde aparece
 * como pendente, e não como atendido. Marcar como atendido o que ninguém
 * verificou é o erro que faz a equipe montar proposta e ser inabilitada na
 * entrega do envelope.
 */

export const prerequisiteStatuses = ["MET", "NOT_MET", "ATTENTION", "UNKNOWN"] as const;
export type PrerequisiteStatus = (typeof prerequisiteStatuses)[number];

/** Quem respondeu: o sistema, com dado próprio, ou a leitura do edital. */
export const prerequisiteSources = ["SISTEMA", "EDITAL"] as const;
export type PrerequisiteSource = (typeof prerequisiteSources)[number];

/**
 * Uma linha do desdobramento de um pré-requisito — hoje só o acervo se
 * desdobra, serviço a serviço.
 *
 * Existe porque "2 serviço(s) comprovados" não diz QUAIS, e quem monta
 * consórcio precisa do nome do serviço que falta, não da contagem. A lista
 * completa vive na aba "Acervo técnico"; aqui ela aparece junto da decisão,
 * que é onde a pergunta é feita.
 */
export type PrerequisiteBreakdownItem = Readonly<{
  label: string;
  status: PrerequisiteStatus;
  detail: string;
}>;

export type Prerequisite = Readonly<{
  id: string;
  label: string;
  status: PrerequisiteStatus;
  source: PrerequisiteSource;
  /** Frase curta com o porquê, para não obrigar a abrir outra tela. */
  detail: string;
  /** Item a item, quando o pré-requisito é a soma de várias exigências. */
  breakdown?: readonly PrerequisiteBreakdownItem[];
}>;

export type PrerequisiteInput = Readonly<{
  archive: ArchiveAdherence;
  /** Dias até o encerramento; ausente quando o órgão não informou. */
  daysToClose?: number;
  /** Mínimo de dias que a equipe considera viável para montar proposta. */
  minimumDays: number;
  estimatedValue?: number;
  valueUndisclosed: boolean;
  /** Piso de valor do perfil, quando configurado. */
  minimumValue?: number;
  /** O que a leitura do edital extraiu. Ausente enquanto ninguém leu. */
  edital?: EditalRequirement;
}>;

const item = (
  id: string,
  label: string,
  status: PrerequisiteStatus,
  source: PrerequisiteSource,
  detail: string,
  breakdown?: readonly PrerequisiteBreakdownItem[],
): Prerequisite => ({ id, label, status, source, detail, ...(breakdown && breakdown.length > 0 ? { breakdown } : {}) });

/**
 * Cada serviço que o edital exige, dito pelo nome, com o veredito do acervo.
 *
 * `required` já traz cobertos e não cobertos (`missing` é um recorte dele), e
 * `unreadable` são as parcelas que o catálogo não classificou — essas não são
 * "não atende", são "ninguém conferiu", e virar cruz aqui faria descartar obra
 * que a empresa sabe fazer.
 */
const detalharAcervo = (archive: ArchiveAdherence): readonly PrerequisiteBreakdownItem[] => [
  ...archive.required.map((servico): PrerequisiteBreakdownItem => ({
    label: servico.label,
    status: servico.covered ? "MET" : "NOT_MET",
    detail: servico.quantity
      ? servico.quantity.explanation
      : servico.covered
        ? `${servico.evidenceCount} atestado(s) no acervo`
        : "nenhum atestado no acervo",
  })),
  ...archive.unreadable.map((texto): PrerequisiteBreakdownItem => ({
    label: texto,
    status: "UNKNOWN",
    detail: "o sistema não soube classificar; confira à mão",
  })),
];

const dinheiro = (valor: number) =>
  `R$ ${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;

/** Pré-requisito que só o edital responde e ninguém leu ainda. */
const pendente = (id: string, label: string): Prerequisite =>
  item(id, label, "UNKNOWN", "EDITAL", "só o edital informa — leitura automática ainda não habilitada");

const simNao = (
  id: string,
  label: string,
  valor: boolean | undefined,
  quandoSim: { status: PrerequisiteStatus; detail: string },
  quandoNao: { status: PrerequisiteStatus; detail: string },
): Prerequisite =>
  valor === undefined
    ? item(id, label, "UNKNOWN", "EDITAL", "o edital foi lido, mas este ponto não foi encontrado")
    : valor
      ? item(id, label, quandoSim.status, "EDITAL", quandoSim.detail)
      : item(id, label, quandoNao.status, "EDITAL", quandoNao.detail);

/**
 * Monta a lista.
 *
 * A ordem é a da decisão: primeiro o que inabilita — acervo —, depois o que
 * custa tempo e dinheiro, por último o que é formalidade.
 */
export function buildPrerequisites(input: PrerequisiteInput): readonly Prerequisite[] {
  const lista: Prerequisite[] = [];

  /* ---------- acervo: o que inabilita ---------- */
  if (!input.archive.determined) {
    lista.push(item("acervo", "Acervo técnico", "UNKNOWN", "SISTEMA", input.archive.reasons[0] ?? "não foi possível julgar"));
  } else if (input.archive.missing.length === 0 && input.archive.unreadable.length > 0) {
    // Cobriu tudo o que soube ler, mas sobrou parcela que não classificou.
    // Dizer "atende" aqui é o "atende" mais perigoso que existe: a equipe monta
    // proposta contando com acervo que ninguém conferiu.
    lista.push(item(
      "acervo", "Acervo técnico", "ATTENTION", "SISTEMA",
      `${input.archive.required.length} serviço(s) comprovados, mas ${input.archive.unreadable.length} parcela(s) do edital o sistema não soube classificar`,
      detalharAcervo(input.archive),
    ));
  } else if (input.archive.missing.length === 0) {
    const comQuantitativo = input.archive.required.filter((r) => r.quantity);
    lista.push(item(
      "acervo", "Acervo técnico", "MET", "SISTEMA",
      comQuantitativo.length > 0
        ? `${input.archive.required.length} serviço(s) comprovados, com quantitativo conferido`
        : `${input.archive.required.length} serviço(s) comprovados no acervo`,
      detalharAcervo(input.archive),
    ));
  } else {
    lista.push(item(
      "acervo", "Acervo técnico", "NOT_MET", "SISTEMA",
      `falta ${input.archive.missing.map((m) => m.label.toLowerCase()).join(", ")}`,
      detalharAcervo(input.archive),
    ));
  }

  /* ---------- porte ---------- */
  if (input.archive.scale === "COVERED" && input.archive.largestExecuted !== undefined) {
    lista.push(item("porte", "Porte compatível", "MET", "SISTEMA", `já executou obra de ${dinheiro(input.archive.largestExecuted)}`));
  } else if (input.archive.scale === "BELOW" && input.archive.largestExecuted !== undefined) {
    lista.push(item("porte", "Porte compatível", "ATTENTION", "SISTEMA",
      `maior obra executada foi ${dinheiro(input.archive.largestExecuted)} — consórcio resolve porte com frequência`));
  } else {
    lista.push(item("porte", "Porte compatível", "UNKNOWN", "SISTEMA",
      input.valueUndisclosed ? "orçamento sigiloso: não há com o que comparar" : "acervo sem valor de contrato cadastrado"));
  }

  /* ---------- prazo ---------- */
  if (input.daysToClose === undefined) {
    lista.push(item("prazo", "Prazo para montar a proposta", "UNKNOWN", "SISTEMA", "o órgão não informou o encerramento"));
  } else if (input.daysToClose < 0) {
    lista.push(item("prazo", "Prazo para montar a proposta", "NOT_MET", "SISTEMA", "prazo encerrado"));
  } else if (input.daysToClose < input.minimumDays) {
    lista.push(item("prazo", "Prazo para montar a proposta", "ATTENTION", "SISTEMA",
      `${input.daysToClose} dia(s), abaixo dos ${input.minimumDays} que a equipe considera viável`));
  } else {
    lista.push(item("prazo", "Prazo para montar a proposta", "MET", "SISTEMA", `${input.daysToClose} dias`));
  }

  /* ---------- valor ---------- */
  if (input.valueUndisclosed || input.estimatedValue === undefined) {
    lista.push(item("valor", "Valor dentro da faixa", "UNKNOWN", "SISTEMA",
      "orçamento sigiloso — comum em obra grande, não é motivo para descartar"));
  } else if (input.minimumValue !== undefined && input.estimatedValue < input.minimumValue) {
    lista.push(item("valor", "Valor dentro da faixa", "NOT_MET", "SISTEMA",
      `${dinheiro(input.estimatedValue)}, abaixo do piso de ${dinheiro(input.minimumValue)}`));
  } else {
    lista.push(item("valor", "Valor dentro da faixa", "MET", "SISTEMA", dinheiro(input.estimatedValue)));
  }

  /* ---------- o que só o edital responde ---------- */
  const edital = input.edital;
  if (!edital) {
    lista.push(
      pendente("consorcio", "Consórcio permitido"),
      pendente("cat", "Atestado registrado no CREA/CAU"),
      pendente("visita", "Visita técnica"),
      pendente("garantia", "Garantia de proposta"),
    );
    return lista;
  }

  lista.push(
    simNao("consorcio", "Consórcio permitido", edital.consortiumAllowed,
      { status: "MET", detail: "o edital admite consórcio" },
      { status: input.archive.needsPartner ? "NOT_MET" : "ATTENTION", detail: "o edital VEDA consórcio: só dá para disputar sozinho" }),
    simNao("cat", "Atestado registrado no CREA/CAU", edital.requiresCat,
      { status: "ATTENTION", detail: "exige CAT registrada — conferir se os atestados estão registrados" },
      { status: "MET", detail: "não exige registro no conselho" }),
    simNao("visita", "Visita técnica", edital.requiresSiteVisit,
      { status: "ATTENTION", detail: "visita obrigatória: programar antes do prazo" },
      { status: "MET", detail: "não exige visita" }),
    simNao("garantia", "Garantia de proposta", edital.requiresProposalBond,
      { status: "ATTENTION", detail: "exige garantia de proposta: providenciar antes do envio" },
      { status: "MET", detail: "não exige garantia de proposta" }),
  );

  // `edital.limitations` não vira item de pré-requisito, de propósito: um
  // item "Leitura do edital" juntando várias frases técnicas com "; " lia
  // como ruído cru dentro de um checklist de sim/não (achado 21/09/2026, na
  // tela real) — e a MESMA lista já aparece no bloco "Parcelas exigidas pelo
  // edital", num lugar mais apropriado para ela.

  return lista;
}

/** Resumo para a linha da fila: quantos atendem, quantos não, quantos pendem. */
export function summarize(prerequisites: readonly Prerequisite[]) {
  return {
    met: prerequisites.filter((p) => p.status === "MET").length,
    notMet: prerequisites.filter((p) => p.status === "NOT_MET").length,
    attention: prerequisites.filter((p) => p.status === "ATTENTION").length,
    unknown: prerequisites.filter((p) => p.status === "UNKNOWN").length,
    total: prerequisites.length,
  };
}
