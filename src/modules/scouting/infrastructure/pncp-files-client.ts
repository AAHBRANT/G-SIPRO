/**
 * Arquivos de uma licitação no PNCP: edital, termo de referência e anexos.
 *
 * O que o edital EXIGE de acervo só existe nestes arquivos. A consulta pública
 * de contratações devolve apenas dados cadastrais — objeto, valor, prazo — e é
 * por isso que a aderência de acervo vinha saindo marcada como estimada.
 *
 * Endpoint conferido contra o serviço real: devolve a lista com título, tipo e
 * uma URL de download direta. O download responde `application/octet-stream`
 * com o nome verdadeiro no `content-disposition`, e não no corpo — daí o tipo
 * ser deduzido da extensão do nome, e não do cabeçalho.
 *
 * A ordem de interesse mora em `edital-relevance`: é a mesma régua que escolhe
 * o anexo certo dentro de um pacote compactado, e ter duas listas divergindo
 * daria uma ordem para o arquivo solto e outra para o mesmo arquivo dentro do
 * .zip.
 */
import { editalRelevance } from "@/modules/scouting/domain/edital-relevance";

const PNCP_BASE_URL = "https://pncp.gov.br/api/pncp/v1";

const LIST_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 90_000;
/** Um edital de obra passa de 10 MB com frequência; acima disto não vale a pena. */
const MAX_FILE_BYTES = 40 * 1024 * 1024;

export type TenderFile = Readonly<{
  title: string;
  /** Tipo declarado pelo órgão: "Edital", "Termo de Referência", "Anexo"… */
  documentType: string;
  url: string;
  sequence: number;
}>;

export type DownloadedFile = Readonly<{
  filename: string;
  mimeType: string;
  bytes: Buffer;
}>;

export type PncpFilesOptions = Readonly<{
  fetchImpl?: typeof fetch;
  maxFileBytes?: number;
}>;

type PncpFileRecord = Readonly<{
  titulo?: string;
  nomeArquivo?: string;
  tipoDocumentoNome?: string;
  tipoDocumentoDescricao?: string;
  url?: string;
  uri?: string;
  sequencialDocumento?: number;
}>;

const weightOf = (file: TenderFile): number => editalRelevance(file.documentType, file.title);

/** Deduz o tipo pelo nome, já que o servidor responde sempre octet-stream. */
export function mimeFromFilename(filename: string): string {
  const extensao = filename.toLowerCase().split(".").pop() ?? "";
  if (extensao === "pdf") return "application/pdf";
  if (extensao === "doc") return "application/msword";
  if (extensao === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extensao === "zip") return "application/zip";
  if (extensao === "rar") return "application/vnd.rar";
  return "application/octet-stream";
}

/** Nome verdadeiro do arquivo, que vem no cabeçalho e não no corpo. */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  if (!match?.[1]) return fallback;
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    // Nome com escape inválido não justifica perder o arquivo.
    return match[1].trim();
  }
}

export class PncpFilesClient {
  constructor(private readonly options: PncpFilesOptions = {}) {}

  private get fetchImpl(): typeof fetch {
    return this.options.fetchImpl ?? fetch;
  }

  /**
   * Lista os arquivos de uma licitação, do mais provável de conter a exigência
   * técnica para o menos.
   */
  async list(authorityDocument: string, year: number, sequence: number): Promise<readonly TenderFile[]> {
    const url = `${PNCP_BASE_URL}/orgaos/${authorityDocument}/compras/${year}/${sequence}/arquivos`;
    const response = await this.fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    });

    // Licitação sem arquivo publicado é comum e não é erro: o órgão às vezes
    // publica o edital só na plataforma de disputa.
    if (response.status === 404 || response.status === 204) return [];
    if (!response.ok) throw new Error(`PNCP respondeu ${response.status} ao listar arquivos.`);

    const registros = (await response.json()) as readonly PncpFileRecord[];
    if (!Array.isArray(registros)) return [];

    return registros
      .flatMap((registro, indice) => {
        const endereco = registro.url ?? registro.uri;
        if (!endereco) return [];
        return [{
          title: (registro.titulo ?? registro.nomeArquivo ?? "documento").trim(),
          documentType: (registro.tipoDocumentoNome ?? registro.tipoDocumentoDescricao ?? "Outros").trim(),
          url: endereco,
          sequence: registro.sequencialDocumento ?? indice + 1,
        }];
      })
      .sort((a, b) => weightOf(a) - weightOf(b) || a.sequence - b.sequence);
  }

  /**
   * Baixa um arquivo. Devolve `null` quando ele passa do teto de tamanho — a
   * alternativa seria estourar a memória do processo por causa de um anexo de
   * projeto com centenas de pranchas.
   */
  async download(file: TenderFile): Promise<DownloadedFile | null> {
    const response = await this.fetchImpl(file.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`PNCP respondeu ${response.status} ao baixar "${file.title}".`);

    const teto = this.options.maxFileBytes ?? MAX_FILE_BYTES;
    const declarado = Number(response.headers.get("content-length") ?? 0);
    if (declarado > teto) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > teto) return null;

    const filename = filenameFromDisposition(response.headers.get("content-disposition"), `${file.title}.pdf`);
    return { filename, mimeType: mimeFromFilename(filename), bytes };
  }
}
