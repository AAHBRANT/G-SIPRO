import type { CandidateTender } from "@/modules/scouting/domain/qualification";

/**
 * Cliente da consulta pública do PNCP (Portal Nacional de Contratações
 * Públicas), veículo oficial de publicidade das licitações brasileiras nos
 * termos do art. 54 da Lei nº 14.133/2021.
 *
 * A interface pública devolve apenas dados cadastrais do certame. Exigências de
 * habilitação — acervo técnico, capital mínimo, garantias — não constam da
 * consulta e só existem no edital e no termo de referência.
 */
const PNCP_BASE_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";

/** Modalidades típicas de obra. Obras não são licitadas por pregão. */
export const workModalityCodes = [4, 5, 2] as const;

/**
 * A consulta é sempre feita por unidade federativa, uma de cada vez. Consultar
 * o país inteiro de uma vez faz o portal responder "erro na comunicação com o
 * banco de dados" (HTTP 500) ou estourar o tempo limite — comportamento
 * verificado contra o serviço real. Fatiar por UF mantém cada consulta pequena
 * o suficiente para o portal atender.
 */
export const brazilStates = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

const PAGE_SIZE = 50;
const MAX_PAGES_PER_MODALITY = 40;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 8;
/** O portal limita a frequência de requisições e responde 429 quando excedida. */
const THROTTLE_DELAY_MS = 700;

type PncpRecord = Readonly<{
  numeroControlePNCP?: string;
  objetoCompra?: string;
  modalidadeNome?: string;
  processo?: string;
  valorTotalEstimado?: number | null;
  dataAberturaProposta?: string | null;
  dataEncerramentoProposta?: string | null;
  linkSistemaOrigem?: string | null;
  anoCompra?: number;
  sequencialCompra?: number;
  orgaoEntidade?: Readonly<{ cnpj?: string; razaoSocial?: string; esferaId?: string }>;
  unidadeOrgao?: Readonly<{ municipioNome?: string; ufSigla?: string }>;
}>;

type PncpPage = Readonly<{ data?: readonly PncpRecord[]; totalPaginas?: number }>;

/**
 * Teto de duração da varredura. A consulta é feita dentro de uma requisição
 * HTTP, e o balanceador do ambiente encerra conexões longas: varrer o país
 * inteiro pode levar dezenas de minutos e seria interrompido no meio, deixando a
 * execução travada. Esgotado o tempo, a varredura para por conta própria e o que
 * ficou de fora é registrado como não consultado.
 */
const DEFAULT_BUDGET_MS = 200_000;

export type PncpFetchOptions = Readonly<{
  finalDate: Date;
  states?: readonly string[];
  /** Teto de duração da varredura, em milissegundos. */
  budgetMs?: number;
  /** Injetável para teste; usa o fetch global por padrão. */
  fetchImpl?: typeof fetch;
  /** Injetável para teste; evita espera real entre requisições. */
  sleepImpl?: (milliseconds: number) => Promise<void>;
  /** Injetável para teste; usa o relógio do sistema por padrão. */
  nowImpl?: () => number;
}>;

const delay = (milliseconds: number) => new Promise<void>((resolve) => { setTimeout(resolve, milliseconds); });

export function formatFinalDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function buildNoticeUrl(record: PncpRecord): string | undefined {
  const document = record.orgaoEntidade?.cnpj;
  const { anoCompra: year, sequencialCompra: sequence } = record;
  if (!document || !year || !sequence) return undefined;
  return `https://pncp.gov.br/app/editais/${document}/${year}/${sequence}`;
}

function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Registro "espelho": abertura e encerramento no mesmo instante. É artefato de
 * cadastro do portal — a mesma contratação aparece duplicada — e não representa
 * um certame com prazo real.
 */
export function isMirrorRecord(record: PncpRecord): boolean {
  const opens = parseDate(record.dataAberturaProposta);
  const closes = parseDate(record.dataEncerramentoProposta);
  return Boolean(opens && closes && opens.getTime() === closes.getTime());
}

export function toCandidate(record: PncpRecord): CandidateTender | undefined {
  const externalId = record.numeroControlePNCP?.trim();
  const subject = record.objetoCompra?.replace(/\s+/g, " ").trim();
  const sphere = record.orgaoEntidade?.esferaId?.trim();
  if (!externalId || !subject || !sphere) return undefined;

  const rawValue = record.valorTotalEstimado;
  // Valor zero ou ausente significa orçamento sigiloso, não obra sem custo.
  const undisclosed = rawValue === null || rawValue === undefined || rawValue <= 0;

  return {
    externalId,
    subject,
    authorityName: record.orgaoEntidade?.razaoSocial?.trim() ?? "Órgão não identificado",
    sphere,
    state: record.unidadeOrgao?.ufSigla?.trim().toUpperCase(),
    estimatedValue: undisclosed ? undefined : Number(rawValue),
    valueUndisclosed: undisclosed,
    proposalClosesAt: parseDate(record.dataEncerramentoProposta),
  };
}

export type PncpTender = Readonly<CandidateTender & {
  authorityDocument?: string;
  city?: string;
  modality: string;
  processNumber?: string;
  proposalOpensAt?: Date;
  noticeUrl?: string;
  sourceUrl?: string;
}>;

function toTender(record: PncpRecord): PncpTender | undefined {
  const candidate = toCandidate(record);
  if (!candidate) return undefined;
  return {
    ...candidate,
    authorityDocument: record.orgaoEntidade?.cnpj?.trim(),
    city: record.unidadeOrgao?.municipioNome?.trim(),
    modality: record.modalidadeNome?.trim() ?? "Concorrência",
    processNumber: record.processo?.trim(),
    proposalOpensAt: parseDate(record.dataAberturaProposta),
    noticeUrl: buildNoticeUrl(record),
    sourceUrl: record.linkSistemaOrigem?.trim() ?? undefined,
  };
}

export class PncpClient {
  constructor(private readonly options: PncpFetchOptions) {}

  private get fetchImpl(): typeof fetch {
    return this.options.fetchImpl ?? fetch;
  }

  private get sleepImpl(): (milliseconds: number) => Promise<void> {
    return this.options.sleepImpl ?? delay;
  }

  private buildUrl(modality: number, page: number, state?: string): string {
    const params = new URLSearchParams({
      dataFinal: formatFinalDate(this.options.finalDate),
      codigoModalidadeContratacao: String(modality),
      pagina: String(page),
      tamanhoPagina: String(PAGE_SIZE),
    });
    if (state) params.set("uf", state);
    return `${PNCP_BASE_URL}?${params.toString()}`;
  }

  /** Reenvia em 429 e 5xx com espera crescente; o portal oscila de desempenho. */
  private async fetchPage(url: string, attempt = 1): Promise<PncpPage> {
    try {
      const response = await this.fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 204) return { data: [], totalPaginas: 0 };
      if (response.status === 429 || response.status >= 500) throw new Error(`HTTP ${response.status}`);
      if (!response.ok) return { data: [], totalPaginas: 0 };
      return (await response.json()) as PncpPage;
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) throw error instanceof Error ? error : new Error(String(error));
      await this.sleepImpl(Math.min(1_500 * attempt, 12_000));
      return this.fetchPage(url, attempt + 1);
    }
  }

  /**
   * Varre as modalidades de obra, unidade federativa por unidade federativa, e
   * devolve as licitações com propostas em aberto — já sem registros espelho e
   * sem repetição do mesmo certame.
   *
   * A falha de uma combinação não interrompe a varredura: o portal oscila, e
   * perder um estado é melhor do que perder a semana inteira. As combinações
   * que falharam são informadas em `failures` para que a execução seja
   * registrada como parcial.
   */
  async fetchOpenTenders(): Promise<{ tenders: readonly PncpTender[]; failures: readonly string[] }> {
    const collected = new Map<string, PncpTender>();
    const failures: string[] = [];
    const states = this.options.states?.length ? this.options.states : brazilStates;
    const now = this.options.nowImpl ?? Date.now;
    const deadline = now() + (this.options.budgetMs ?? DEFAULT_BUDGET_MS);
    let exhausted = false;

    for (const modality of workModalityCodes) {
      for (const state of states) {
        if (exhausted || now() >= deadline) {
          exhausted = true;
          failures.push(`${state}/${modality}`);
          continue;
        }
        try {
          let page = 1;
          let totalPages = 1;
          do {
            const payload = await this.fetchPage(this.buildUrl(modality, page, state));
            totalPages = Math.min(payload.totalPaginas ?? 0, MAX_PAGES_PER_MODALITY);
            for (const record of payload.data ?? []) {
              if (isMirrorRecord(record)) continue;
              const tender = toTender(record);
              if (tender && !collected.has(tender.externalId)) collected.set(tender.externalId, tender);
            }
            await this.sleepImpl(THROTTLE_DELAY_MS);
            page += 1;
          } while (page <= totalPages && now() < deadline);
        } catch {
          failures.push(`${state}/${modality}`);
        }
      }
    }

    return { tenders: [...collected.values()], failures };
  }
}
