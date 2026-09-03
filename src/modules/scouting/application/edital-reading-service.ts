/**
 * Leitura do edital de uma licitação rastreada.
 *
 * A fila de triagem responde sozinha só o que o próprio sistema apura: acervo,
 * porte, prazo e valor. Consórcio, CAT, visita técnica e — o que mais pesa — as
 * PARCELAS DE MAIOR RELEVÂNCIA com quantitativo mínimo só existem no edital.
 * Sem lê-lo, a exigência de acervo é deduzida do objeto, e a tela tem de dizer
 * "estimado" em toda linha.
 *
 * O encadeamento é: número de controle → arquivos no PNCP → pacote aberto, se
 * for o caso → o documento mais provável de trazer a qualificação técnica →
 * leitura com o caso de uso aprovado → exigência interpretada → gravada com o
 * endereço de origem.
 *
 * Duas coisas que só ficaram claras lendo um edital de verdade à mão:
 *
 * 1. O órgão publica UM arquivo compactado, e não um PDF. Pedra Preta/MT
 *    publicou um .zip com um .rar dentro, e os 18 documentos só existem lá.
 * 2. A exigência que decide habilitação NÃO está no edital. As seis parcelas
 *    de maior relevância, com quantitativo, estavam na "Justificativa de
 *    Qualificação Técnica"; o edital só remete a ela. Quem lê só o edital sai
 *    sem número nenhum — e sem número o confronto com o acervo vira "tem ou
 *    não tem a disciplina", que era a limitação que a leitura veio remover.
 *
 * Daí a leitura poder gastar DUAS chamadas: a primeira no documento que traz
 * as parcelas, a segunda no edital, que é onde ficam consórcio, CAT e visita.
 * A segunda só acontece quando a primeira deixou algum desses três em aberto.
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
import { editalRelevance, isEdital } from "@/modules/scouting/domain/edital-relevance";
import { parsePncpIdentifier } from "@/modules/scouting/domain/pncp-identifier";
import { normalizeText } from "@/modules/scouting/domain/qualification";
import { listArchive } from "@/modules/scouting/infrastructure/archive-files";
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
 * modelo lê PDF — uma planilha de orçamento ou um .doc voltariam como bytes sem
 * sentido, gastando a chamada para não achar nada.
 *
 * O teste é feito DEPOIS de baixar, e não pela URL: o endereço do PNCP não tem
 * extensão (termina em `/arquivos/3`), e o nome verdadeiro só chega no
 * cabeçalho da resposta. Filtrar antes descartaria todos os arquivos.
 */
const isPdf = (file: DownloadedFile): boolean => file.mimeType === "application/pdf";
const pdfPeloNome = (filename: string): boolean => /\.pdf$/i.test(filename.trim());

/**
 * Quantos arquivos publicados baixar depois de já ter algo legível em mãos.
 *
 * A lista vem ordenada por relevância, então o que interessa está no começo, e
 * há órgão que publica 40 arquivos — baixar todos custaria minutos por
 * licitação. Mas o teto só vale DEPOIS que a fila tem um PDF: enquanto ela
 * estiver vazia, parar no terceiro arquivo abandonaria a licitação cujo único
 * PDF é o quarto da lista (dois .docx e um .dwg na frente é combinação
 * banal), coisa que o laço antigo, sem teto, nunca fazia.
 */
const MAX_DOWNLOADS_COM_ACHADO = 3;
/** Teto absoluto, para o órgão que publica 40 anexos e nenhum PDF. */
const MAX_DOWNLOADS = 8;

/** O `sourceFilename` é VarChar(255) no banco e `shortText(255)` no zod. */
const MAX_LABEL = 255;

/** Um PDF que dá para mandar ler, solto ou de dentro de um pacote. */
type Readable = Readonly<{
  /** Peso da régua de relevância: menor é mais provável trazer a exigência. */
  weight: number;
  /** É o edital propriamente dito — quem responde consórcio, CAT e visita. */
  ehEdital: boolean;
  /** Desempate estável, na ordem em que apareceu. */
  order: number;
  /** Endereço público do arquivo no PNCP — é o link de download do cartão. */
  uri: string;
  /** Nome do que será lido, com o caminho dentro do pacote quando houver. */
  label: string;
  /** Como o órgão classificou o arquivo publicado. */
  documentType: string;
  read: () => Promise<Buffer>;
}>;

/**
 * Corta o nome pelo COMEÇO, e não pelo fim.
 *
 * O caminho dentro do pacote cresce à esquerda (`pacote.zip → anexos.rar →
 * 03 - PROJETO BASICO/…/MEMORIAL.pdf`) e é o fim que identifica o documento.
 * Cortar pelo fim gravaria 255 caracteres de prefixo e nenhum nome de arquivo.
 */
const encurtar = (label: string): string =>
  label.length <= MAX_LABEL ? label : `…${label.slice(label.length - MAX_LABEL + 1)}`;

const message = (error: unknown): string =>
  error instanceof Error ? error.message : "Falha não identificada na leitura do edital.";

/** Os três que só o edital responde, e que a tela mostra como pré-requisito. */
const faltaInstitucional = (requirement: EditalRequirement): boolean =>
  requirement.consortiumAllowed === undefined
  || requirement.requiresCat === undefined
  || requirement.requiresSiteVisit === undefined;

const chaveServico = (descricao: string): string => normalizeText(descricao).replace(/\s+/g, " ").trim();

/**
 * Junta a leitura do anexo com a do edital.
 *
 * A base manda: ela veio do documento mais específico. O edital entra só onde a
 * base ficou em branco — nunca por cima. Um edital que diz "conforme anexo"
 * seria lido como "não informa quantitativo", e deixá-lo sobrescrever as
 * parcelas do anexo apagaria justamente o que se foi buscar.
 */
export function mergeReadings(
  base: EditalRequirement,
  extra: EditalRequirement,
  origem: string,
): EditalRequirement {
  const vistos = new Set(base.services.map((s) => chaveServico(s.description)));
  const novos = extra.services.filter((s) => {
    const chave = chaveServico(s.description);
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  const juntou = novos.length > 0
    || (base.consortiumAllowed === undefined && extra.consortiumAllowed !== undefined)
    || (base.requiresCat === undefined && extra.requiresCat !== undefined)
    || (base.requiresSiteVisit === undefined && extra.requiresSiteVisit !== undefined);

  const confiancas = [base.confidence, extra.confidence].filter((c): c is number => c !== undefined);
  const primeiro = (a?: boolean, b?: boolean) => (a !== undefined ? a : b);
  const consortiumAllowed = primeiro(base.consortiumAllowed, extra.consortiumAllowed);
  const requiresCat = primeiro(base.requiresCat, extra.requiresCat);
  const requiresSiteVisit = primeiro(base.requiresSiteVisit, extra.requiresSiteVisit);

  return {
    services: [...base.services, ...novos],
    ...(consortiumAllowed !== undefined ? { consortiumAllowed } : {}),
    ...(requiresCat !== undefined ? { requiresCat } : {}),
    ...(requiresSiteVisit !== undefined ? { requiresSiteVisit } : {}),
    // A menor das confianças: o conjunto não é mais confiável do que a sua
    // parte mais fraca.
    ...(confiancas.length > 0 ? { confidence: Math.min(...confiancas) } : {}),
    // Sem repetir: as duas leituras costumam esbarrar na mesma limitação ("não
    // foi possível determinar a visita técnica"), e a tela mostraria a frase
    // duas vezes como se fossem dois problemas.
    limitations: [...new Set([
      ...base.limitations,
      ...extra.limitations,
      // Fica gravado de onde veio o complemento: quem conferir na mão precisa
      // saber que a resposta não estava no mesmo documento.
      ...(juntou ? [`Complementado com a leitura de "${origem}".`] : []),
    ])],
  };
}

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

      const { pool, oversized } = await this.gather(candidates);
      if (pool.length === 0) {
        return oversized ? { status: "FILE_TOO_LARGE", title: oversized.title } : { status: "NO_FILE" };
      }

      // Menor peso primeiro: justificativa de qualificação técnica, termo de
      // referência, projeto básico, edital, o resto.
      const ordenados = [...pool].sort((a, b) => a.weight - b.weight || a.order - b.order);

      // ⚠️ Descompactar é o primeiro momento em que o conteúdo do membro é
      // tocado de verdade: a listagem só leu cabeçalhos. Um PDF compactado em
      // LZMA ou Deflate64 (o 7-Zip e o WinRAR produzem os dois) aparece na fila
      // e só estoura aqui. Cair fora nesse ponto descartaria a licitação tendo
      // o EDITAL.pdf legível logo atrás na fila, então tenta-se o seguinte.
      let principal: Readable | undefined;
      let bytes: Buffer | undefined;
      for (const candidato of ordenados) {
        try {
          bytes = await candidato.read();
          principal = candidato;
          break;
        } catch {
          continue;
        }
      }
      if (!principal || !bytes) return { status: "NO_FILE" };

      // O edital só entra como segunda leitura quando o principal NÃO é ele: aí
      // o principal traz as parcelas e o edital fecha consórcio, CAT e visita.
      //
      // A pergunta é "este documento é o edital?", nunca "o peso dele é 30?".
      // O peso é o mínimo entre os padrões que casaram, então um arquivo
      // chamado `EDITAL PREGAO 17-2026 TR.pdf` sai com peso 10 e continua sendo
      // o edital — comparar o número deixaria a segunda leitura sem acontecer.
      const complemento = principal.ehEdital
        ? undefined
        : ordenados.find((item) => item !== principal && item.ehEdital);

      const fileHash = createHash("sha256").update(bytes).digest("hex");
      const execution = await this.extract(principal, bytes, fileHash, definition, tender.title, auth, correlationId);

      const executionId = idOf(execution);
      if (!executionId) return { status: "FAILED", reason: "A execução de IA não devolveu identificador." };

      let requirement = interpret(execution);
      // Qual execução responde pelo que foi gravado. Quando o provedor falha na
      // primeira, a linha volta com status FAILED e sem saída, e apontar o
      // rastro de auditoria para ela diria que a exigência veio de uma leitura
      // que não leu nada — o conteúdo teria vindo todo da segunda.
      let executionIdDoConteudo = deuCerto(execution) ? executionId : undefined;

      if (complemento && faltaInstitucional(requirement)) {
        try {
          const extraBytes = await complemento.read();
          const extraHash = createHash("sha256").update(extraBytes).digest("hex");
          const outra = await this.extract(
            complemento, extraBytes, extraHash, definition, tender.title, auth, correlationId,
          );
          requirement = mergeReadings(requirement, interpret(outra), complemento.label);
          executionIdDoConteudo ??= deuCerto(outra) ? idOf(outra) : undefined;
        } catch {
          // A leitura principal já vale por si. Perder o complemento deixa
          // consórcio/CAT/visita em "a conferir", que é o estado honesto — e
          // muito melhor do que descartar as parcelas já lidas.
        }
      }

      // Extração que não devolveu campo nenhum não vira leitura gravada: a
      // ausência de parcelas seria lida depois como "o edital não exige nada".
      if (requirement.services.length === 0 && requirement.consortiumAllowed === undefined
        && requirement.requiresCat === undefined && requirement.requiresSiteVisit === undefined) {
        return { status: "NOTHING_EXTRACTED", executionId };
      }

      const reading = await this.readings.save(
        {
          tenderId,
          executionId: executionIdDoConteudo ?? executionId,
          // O endereço é o do arquivo PUBLICADO, mesmo quando o que foi lido
          // estava dentro dele: é esse o link que o cartão oferece, e é o que a
          // pessoa precisa abrir para baixar o pacote sem navegar o portal.
          source: { uri: principal.uri, filename: principal.label, fileHash, fetchedAt: new Date() },
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

  /**
   * Baixa os candidatos mais promissores e reúne todo PDF legível — inclusive
   * os que estão dentro de um pacote compactado.
   *
   * Para pesar um membro de pacote vale só o nome dele. O tipo que o órgão
   * declarou é do pacote inteiro ("Edital", "Anexo") e, se entrasse na conta,
   * daria o mesmo peso às pranchas e à justificativa de qualificação técnica —
   * achatando exatamente a distinção que interessa.
   */
  private async gather(
    candidates: readonly TenderFile[],
  ): Promise<Readonly<{ pool: readonly Readable[]; oversized?: TenderFile }>> {
    const pool: Readable[] = [];
    let oversized: TenderFile | undefined;
    let baixados = 0;

    for (const candidate of candidates) {
      // Já temos o documento das parcelas E o edital: mais download não muda a
      // leitura, só atrasa.
      if (pool.some((d) => !d.ehEdital) && pool.some((d) => d.ehEdital)) break;
      // O teto barato só vale quando já há algo legível; sem nada em mãos, vale
      // o teto absoluto.
      if (baixados >= (pool.length > 0 ? MAX_DOWNLOADS_COM_ACHADO : MAX_DOWNLOADS)) break;

      let file: DownloadedFile | null;
      try {
        file = await this.files.download(candidate);
      } catch {
        // O PNCP responde 502 num anexo com frequência. Derrubar a licitação
        // inteira por causa disso descartaria o documento perfeito que já pode
        // estar na fila, ou o próximo candidato, que costuma servir.
        baixados += 1;
        continue;
      }
      baixados += 1;
      if (!file) { oversized ??= candidate; continue; }

      const membros = await listArchive(file);
      if (membros.length === 0) {
        if (isPdf(file)) {
          pool.push({
            weight: editalRelevance(candidate.documentType, candidate.title, file.filename),
            ehEdital: isEdital(candidate.documentType, candidate.title, file.filename),
            order: pool.length,
            uri: candidate.url,
            label: encurtar(file.filename),
            documentType: candidate.documentType,
            read: async () => file.bytes,
          });
        }
        continue;
      }

      for (const membro of membros) {
        if (!pdfPeloNome(membro.filename)) continue;
        pool.push({
          weight: editalRelevance(membro.filename),
          ehEdital: isEdital(membro.filename),
          order: pool.length,
          uri: candidate.url,
          label: encurtar(membro.path),
          documentType: candidate.documentType,
          read: () => membro.read(),
        });
      }
    }

    return { pool, ...(oversized ? { oversized } : {}) };
  }

  /** Uma leitura: bytes que não serão guardados, com o rastro do que foi lido. */
  private extract(
    documento: Readable,
    bytes: Buffer,
    fileHash: string,
    definition: Readonly<{ id: string; promptHash: string }>,
    tenderTitle: string,
    auth: AuthorizationContext,
    correlationId: string,
  ): Promise<unknown> {
    return this.extraction.runEphemeral(
      {
        // A chave carrega o hash do arquivo E o do prompt: repetir a leitura do
        // mesmo edital não paga de novo, mas mudar o prompt permite reler em vez
        // de esbarrar na idempotência da chamada anterior.
        idempotencyKey: `edital:${fileHash.slice(0, 32)}:${definition.promptHash.slice(0, 32)}`,
        definitionId: definition.id,
        requestedFields: editalFields,
        source: {
          uri: documento.uri,
          filename: documento.label,
          mimeType: "application/pdf",
          documentType: EDITAL_DOCUMENT_TYPE,
          title: `${documento.documentType} — ${tenderTitle}`.slice(0, 255),
        },
        bytes,
      },
      auth,
      correlationId,
    );
  }
}

/** A execução chegou ao fim com resultado; FAILED volta com saída vazia. */
const deuCerto = (execution: unknown): boolean =>
  (execution as { status?: unknown } | null)?.status !== "FAILED";

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
