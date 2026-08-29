/**
 * Leitura do edital de uma licitação rastreada.
 *
 * A fila de triagem responde sozinha só o que o próprio sistema apura: acervo,
 * porte, prazo e valor. Consórcio, CAT, visita técnica e — o que mais pesa — as
 * PARCELAS DE MAIOR RELEVÂNCIA com quantitativo mínimo só existem no edital.
 * Sem lê-lo, a exigência de acervo é deduzida do objeto, e a tela tem de dizer
 * "estimado" em toda linha.
 *
 * O encadeamento é: número de controle → arquivos no PNCP → o arquivo mais
 * provável de trazer a qualificação técnica → leitura com o caso de uso
 * aprovado → exigência interpretada → gravada com o endereço de origem.
 *
 * ⚠️ O PDF NÃO É GUARDADO. São ~453 editais de ~12 MB por varredura, perto de
 * 5 GB de arquivo público que o PNCP já hospeda e serve por URL direta. O que
 * fica é a informação lida, o SHA-256 do que foi lido, e o endereço — que é
 * também o link de download que o cartão oferece, para a pessoa baixar sem
 * navegar o portal.
 *
 * ⚠️ Nada aqui lança quando a leitura não sai. Uma licitação sem edital
 * publicado, um anexo de 200 MB ou um PNCP fora do ar são rotina, e derrubar o
 * lote inteiro por causa de uma delas deixaria as outras 452 sem leitura. Cada
 * caso volta como um desfecho nomeado, que a tela transforma em "a conferir" —
 * nunca em "atende".
 */
import { createHash, randomUUID } from "node:crypto";

import type { AuthorizationContext } from "@/core/authorization/policy";
import {
  parseEditalRequirement,
  editalFields,
  type EditalRequirement,
} from "@/modules/scouting/domain/edital-requirement";
import { parsePncpIdentifier } from "@/modules/scouting/domain/pncp-identifier";
import type { DownloadedFile, TenderFile } from "@/modules/scouting/infrastructure/pncp-files-client";
import { fieldsFromExtractionOutput } from "@/modules/technical-archive/domain/extracted-services";

/** Tipo documental declarado à governança. Constante de propósito: é o que
 *  casa o caso de uso aprovado, e não pode vir de fora. */
export const EDITAL_DOCUMENT_TYPE = "EDITAL";

/** De onde os bytes vieram, e para onde o cartão manda a pessoa baixar. */
export type EditalSource = Readonly<{
  uri: string;
  filename: string;
  fileHash: string;
  fetchedAt: Date;
}>;

export type StoredEditalReading = Readonly<{
  tenderId: string;
  executionId: string;
  source: EditalSource;
  requirement: EditalRequirement;
  reviewedAt?: Date;
}>;

/**
 * Desfecho da leitura. É uma união fechada de propósito: quem chama tem de
 * tratar cada motivo, e a tela consegue dizer POR QUE um pré-requisito segue
 * pendente em vez de mostrar um silêncio.
 */
export type EditalReadingOutcome =
  | Readonly<{ status: "READ"; reading: StoredEditalReading }>
  | Readonly<{ status: "ALREADY_READ"; reading: StoredEditalReading }>
  | Readonly<{ status: "NOT_CONFIGURED" }>
  | Readonly<{ status: "TENDER_NOT_FOUND" }>
  | Readonly<{ status: "NO_IDENTIFIER"; externalId: string }>
  | Readonly<{ status: "NO_FILE" }>
  | Readonly<{ status: "FILE_TOO_LARGE"; title: string }>
  | Readonly<{ status: "NOTHING_EXTRACTED"; executionId: string }>
  | Readonly<{ status: "FAILED"; reason: string }>;

export interface TenderFilesPort {
  list(authorityDocument: string, year: number, sequence: number): Promise<readonly TenderFile[]>;
  download(file: TenderFile): Promise<DownloadedFile | null>;
}

export interface EditalExtractionPort {
  /** Caso de uso aprovado, na versão vigente, autorizado para este tipo documental. */
  approvedDefinition(
    documentType: string,
  ): Promise<Readonly<{ id: string; promptHash: string }> | undefined>;
  /**
   * Roda a extração sobre bytes que não serão preservados. Devolve o
   * identificador da execução junto do resultado: é o vínculo que substitui o
   * arquivo guardado no rastro de auditoria.
   */
  runEphemeral(
    input: Readonly<{
      idempotencyKey: string;
      definitionId: string;
      requestedFields: readonly string[];
      source: Readonly<{ uri: string; filename: string; mimeType: string; documentType: string; title: string }>;
      bytes: Buffer;
    }>,
    auth: AuthorizationContext,
    correlationId: string,
  ): Promise<unknown>;
}

export interface EditalReadingRepository {
  tender(tenderId: string): Promise<Readonly<{ id: string; externalId: string; title: string }> | undefined>;
  find(tenderId: string): Promise<StoredEditalReading | undefined>;
  save(
    input: Readonly<{
      tenderId: string;
      executionId: string;
      source: EditalSource;
      requirement: EditalRequirement;
    }>,
    actorId: string,
    correlationId: string,
  ): Promise<StoredEditalReading>;
}

/**
 * Só PDF. O provedor aprovado manda o arquivo como `input_file` em base64, e o
 * modelo lê PDF — um .zip de projeto ou um .doc voltariam como bytes sem
 * sentido, gastando a chamada para não achar nada.
 *
 * O teste é feito DEPOIS de baixar, e não pela URL: o endereço do PNCP não tem
 * extensão (termina em `/arquivos/3`), e o nome verdadeiro só chega no
 * cabeçalho da resposta. Filtrar antes descartaria todos os arquivos.
 */
const isPdf = (file: DownloadedFile): boolean => file.mimeType === "application/pdf";

const message = (error: unknown): string =>
  error instanceof Error ? error.message : "Falha não identificada na leitura do edital.";

export class EditalReadingService {
  constructor(
    private readonly files: TenderFilesPort,
    private readonly extraction: EditalExtractionPort,
    private readonly readings: EditalReadingRepository,
  ) {}

  async read(
    tenderId: string,
    auth: AuthorizationContext,
    correlationId: string = randomUUID(),
  ): Promise<EditalReadingOutcome> {
    const tender = await this.readings.tender(tenderId);
    if (!tender) return { status: "TENDER_NOT_FOUND" };

    // Reler custa uma chamada paga e não muda nada: o edital já publicado não
    // se altera sem virar outro arquivo, com outro hash.
    const existing = await this.readings.find(tenderId);
    if (existing) return { status: "ALREADY_READ", reading: existing };

    const definition = await this.extraction.approvedDefinition(EDITAL_DOCUMENT_TYPE);
    if (!definition) return { status: "NOT_CONFIGURED" };

    const identifier = parsePncpIdentifier(tender.externalId);
    if (!identifier) return { status: "NO_IDENTIFIER", externalId: tender.externalId };

    try {
      const candidates = await this.files.list(identifier.authorityDocument, identifier.year, identifier.sequence);
      if (candidates.length === 0) return { status: "NO_FILE" };

      // A lista já vem na ordem de interesse: termo de referência, projeto
      // básico, edital, anexo. O primeiro PDF que couber no teto é o escolhido.
      let downloaded: DownloadedFile | undefined;
      let chosen: TenderFile | undefined;
      let oversized: TenderFile | undefined;
      for (const candidate of candidates) {
        const file = await this.files.download(candidate);
        if (!file) { oversized ??= candidate; continue; }
        if (!isPdf(file)) continue;
        downloaded = file;
        chosen = candidate;
        break;
      }
      if (!downloaded || !chosen) {
        return oversized ? { status: "FILE_TOO_LARGE", title: oversized.title } : { status: "NO_FILE" };
      }

      const fileHash = createHash("sha256").update(downloaded.bytes).digest("hex");

      // A chave carrega o hash do arquivo E o do prompt: repetir a leitura do
      // mesmo edital não paga de novo, mas mudar o prompt permite reler em vez
      // de esbarrar na idempotência da chamada anterior.
      const execution = await this.extraction.runEphemeral(
        {
          idempotencyKey: `edital:${fileHash.slice(0, 32)}:${definition.promptHash.slice(0, 32)}`,
          definitionId: definition.id,
          requestedFields: editalFields,
          source: {
            uri: chosen.url,
            filename: downloaded.filename,
            mimeType: downloaded.mimeType,
            documentType: EDITAL_DOCUMENT_TYPE,
            title: `${chosen.documentType} — ${tender.title}`.slice(0, 255),
          },
          bytes: downloaded.bytes,
        },
        auth,
        correlationId,
      );

      const executionId = idOf(execution);
      if (!executionId) return { status: "FAILED", reason: "A execução de IA não devolveu identificador." };

      const requirement = interpret(execution);
      // Extração que não devolveu campo nenhum não vira leitura gravada: a
      // ausência de parcelas seria lida depois como "o edital não exige nada".
      if (requirement.services.length === 0 && requirement.consortiumAllowed === undefined
        && requirement.requiresCat === undefined && requirement.requiresSiteVisit === undefined) {
        return { status: "NOTHING_EXTRACTED", executionId };
      }

      const reading = await this.readings.save(
        {
          tenderId,
          executionId,
          source: { uri: chosen.url, filename: downloaded.filename, fileHash, fetchedAt: new Date() },
          requirement,
        },
        auth.actorId,
        correlationId,
      );
      return { status: "READ", reading };
    } catch (error) {
      return { status: "FAILED", reason: message(error).slice(0, 500) };
    }
  }
}

const idOf = (execution: unknown): string | undefined => {
  const id = (execution as { id?: unknown } | null)?.id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
};

/** Lê o resultado da execução, seja qual for o formato em que ele volta. */
function interpret(execution: unknown): EditalRequirement {
  const output = (execution as { output?: unknown } | null)?.output;
  const fields = fieldsFromExtractionOutput(output);
  const registro = execution as { confidence?: unknown; limitations?: unknown } | null;
  const confidence = registro?.confidence === null || registro?.confidence === undefined
    ? undefined
    // Decimal do Prisma não é number: comparar sem converter daria falso.
    : Number(registro.confidence);
  const limitations = Array.isArray(registro?.limitations)
    ? registro.limitations.filter((item): item is string => typeof item === "string")
    : [];
  return parseEditalRequirement(fields, {
    ...(confidence !== undefined && Number.isFinite(confidence) ? { confidence } : {}),
    limitations,
  });
}
