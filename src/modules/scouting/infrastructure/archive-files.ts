/**
 * Abre o pacote que o órgão publicou no lugar do edital.
 *
 * Metade das prefeituras não publica o edital como PDF: publica UM arquivo
 * compactado com o pacote inteiro. Pedra Preta/MT publicou
 * `199051_editais_1787665929.zip` (19,5 MB) contendo `ANEXOS DO EDITAL.rar`,
 * e só dentro do RAR estão os 18 arquivos — entre eles a justificativa de
 * qualificação técnica, que é onde moram as parcelas de maior relevância. Sem
 * este módulo o serviço via um `application/zip`, não reconhecia como PDF e
 * devolvia NO_FILE: licitação de R$ 2,9 mi parada na fila como "a conferir".
 *
 * ⚠️ Listar é separado de ler, e é de propósito. O pacote acima tem 21 MB
 * descompactados, dos quais 17,9 MB são um único PDF de pranchas que não
 * interessa a habilitação nenhuma. Descompactar tudo para escolher um arquivo
 * seria pagar a memória do pior anexo em toda licitação da varredura. Aqui o
 * nome de cada entrada sai sem inflar um byte, quem chama escolhe, e só o
 * escolhido é descompactado.
 *
 * ⚠️ Os tetos não são folclore de defensividade: um .zip de 300 KB pode
 * declarar 40 GB descompactados, e é um jeito conhecido de derrubar processo
 * alheio. O teto por entrada é conferido no cabeçalho ANTES de inflar, e o
 * total do pacote limita o conjunto.
 */
import { unzipSync } from "fflate";

import type { DownloadedFile } from "@/modules/scouting/infrastructure/pncp-files-client";

export type ArchiveKind = "zip" | "rar";

export type ArchiveLimits = Readonly<{
  /** Teto de uma entrada descompactada. */
  maxEntryBytes: number;
  /** Teto do que se pode materializar somando tudo do pacote. */
  maxTotalBytes: number;
  /** Quantas entradas listar. Pacote de projeto passa de 200 arquivos. */
  maxEntries: number;
  /** Pacote dentro de pacote. 2 cobre o zip→rar do PNCP; 3 é folga. */
  maxDepth: number;
}>;

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxEntryBytes: 40 * 1024 * 1024,
  maxTotalBytes: 120 * 1024 * 1024,
  maxEntries: 300,
  maxDepth: 3,
};

/** Uma entrada do pacote. Os bytes só existem depois que alguém chama `read`. */
export type ArchiveEntry = Readonly<{
  /** Caminho legível, com os pacotes atravessados: `pacote.zip → anexos.rar → EDITAL.pdf`. */
  path: string;
  /** Só o nome do arquivo, para casar com a régua de relevância. */
  filename: string;
  /** Tamanho descompactado declarado no cabeçalho. */
  size: number;
  read: () => Promise<Buffer>;
}>;

const SEPARADOR = " → ";

/** Reconhece pacote pela extensão e, se ela faltar, pela assinatura. */
export function archiveKind(filename: string, bytes?: Buffer): ArchiveKind | null {
  const extensao = filename.toLowerCase().split(".").pop() ?? "";
  if (extensao === "zip") return "zip";
  if (extensao === "rar") return "rar";
  // O PNCP responde `application/octet-stream` com nome sem extensão em parte
  // das licitações; aí só a assinatura conta.
  if (!bytes || bytes.byteLength < 8) return null;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)) return "zip";
  if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21) return "rar";
  return null;
}

const nomeDe = (caminho: string): string => caminho.split(/[\\/]/).pop() ?? caminho;
const ehDiretorio = (caminho: string): boolean => caminho.endsWith("/") || caminho.endsWith("\\");

/** Orçamento de bytes do pacote inteiro, compartilhado entre os níveis. */
class Orcamento {
  private gasto = 0;
  constructor(private readonly teto: number) {}
  cabe(bytes: number): boolean {
    return this.gasto + bytes <= this.teto;
  }
  gastar(bytes: number): void {
    this.gasto += bytes;
  }
}

/**
 * Lista o que existe dentro do arquivo baixado.
 *
 * Devolve lista vazia quando ele não é pacote — quem chama trata o arquivo
 * como está. Pacote protegido por senha, corrompido ou em formato que a
 * biblioteca não abre também sai como lista vazia: é rotina do PNCP e não pode
 * derrubar a leitura das outras 452 licitações da varredura.
 */
export async function listArchive(
  file: DownloadedFile,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): Promise<readonly ArchiveEntry[]> {
  const tipo = archiveKind(file.filename, file.bytes);
  if (!tipo) return [];
  const orcamento = new Orcamento(limits.maxTotalBytes);
  try {
    return await listar(tipo, file.filename, file.bytes, 1, limits, orcamento);
  } catch {
    // Não relançar: `FAILED` por causa de um .rar quebrado esconderia que a
    // licitação simplesmente não tem edital legível publicado.
    return [];
  }
}

async function listar(
  tipo: ArchiveKind,
  prefixo: string,
  bytes: Buffer,
  profundidade: number,
  limits: ArchiveLimits,
  orcamento: Orcamento,
): Promise<readonly ArchiveEntry[]> {
  const cruas = tipo === "zip" ? listarZip(prefixo, bytes, limits) : await listarRar(prefixo, bytes, limits);

  const saida: ArchiveEntry[] = [];
  for (const entrada of cruas) {
    if (saida.length >= limits.maxEntries) break;

    const aninhado = archiveKind(entrada.filename);
    if (!aninhado) {
      saida.push(entrada);
      continue;
    }
    // Pacote dentro de pacote: precisa dos bytes para listar o que tem dentro.
    // É o único caso em que materializamos sem ninguém ter escolhido.
    //
    // ⚠️ Os DOIS tetos, e não só o do orçamento. `read()` recusa entrada acima
    // de `maxEntryBytes`, e conferir só o orçamento total deixaria passar um
    // anexo de 60 MB que estoura lá dentro — derrubando o pacote inteiro por
    // causa de uma proteção que deveria só pular o anexo.
    if (profundidade >= limits.maxDepth) continue;
    if (entrada.size > limits.maxEntryBytes || !orcamento.cabe(entrada.size)) continue;
    try {
      const conteudo = await entrada.read();
      orcamento.gastar(conteudo.byteLength);
      saida.push(...(await listar(aninhado, entrada.path, conteudo, profundidade + 1, limits, orcamento)));
    } catch {
      // ⚠️ Um anexo ruim não pode custar o pacote. Sem este try, um único
      // `FOTOS DA OBRA.rar` corrompido, protegido por senha, ou que na verdade
      // é um PDF renomeado, desenrolava a recursão inteira até o catch de
      // `listArchive` — que devolve [] — e jogava fora o EDITAL.pdf e a
      // justificativa já listados. A licitação virava NO_FILE tendo edital
      // publicado e legível.
      continue;
    }
  }
  return saida;
}

function listarZip(prefixo: string, bytes: Buffer, limits: ArchiveLimits): readonly ArchiveEntry[] {
  const dados = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entradas: ArchiveEntry[] = [];
  const vistos = new Set<string>();

  // O `filter` do fflate recebe o cabeçalho de cada entrada e decide se ela é
  // inflada. Devolvendo sempre `false` percorremos o índice do pacote sem
  // descompactar nada — é a listagem barata.
  unzipSync(dados, {
    filter: (info) => {
      const nome = info.name;
      // ⚠️ Nome repetido no índice é entrada só uma vez. O formato .zip aceita
      // N registros com o mesmo nome, e endereçar a leitura pelo nome não
      // consegue distinguir entre eles — pior, o filtro casaria os N.
      if (!ehDiretorio(nome) && !vistos.has(nome) && entradas.length < limits.maxEntries) {
        vistos.add(nome);
        const size = info.originalSize;
        entradas.push({
          path: `${prefixo}${SEPARADOR}${nome}`,
          filename: nomeDe(nome),
          size,
          read: async () => {
            if (size > limits.maxEntryBytes) throw new Error(`"${nome}" passa do teto por arquivo.`);
            // ⚠️ Uma vez só, e conferindo o tamanho DA ENTRADA QUE VAI INFLAR.
            // Um pacote com 40 registros chamados "a.pdf" fazia o filtro casar
            // os 40: o teto era conferido contra o cabeçalho do primeiro e o
            // fflate inflava todos. Medido: .zip de 33 KB virando 1.800 MB e
            // 4 s de event loop travado numa única leitura — um jeito barato de
            // derrubar o container a partir de um arquivo público.
            let pego = false;
            const so = unzipSync(dados, {
              filter: (f) => {
                if (pego || f.name !== nome) return false;
                if (f.originalSize > limits.maxEntryBytes) return false;
                pego = true;
                return true;
              },
            })[nome];
            if (!so) throw new Error(`"${nome}" não pôde ser descompactado.`);
            return Buffer.from(so);
          },
        });
      }
      return false;
    },
  });
  return entradas;
}

async function listarRar(prefixo: string, bytes: Buffer, limits: ArchiveLimits): Promise<readonly ArchiveEntry[]> {
  // Import dinâmico: o unrar é WebAssembly, e carregá-lo no arranque custaria a
  // toda requisição do app o preço de um formato que aparece de vez em quando.
  const { createExtractorFromData } = await import("node-unrar-js");
  const dados = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const extrator = await createExtractorFromData({ data: dados });

  const entradas: ArchiveEntry[] = [];
  const vistos = new Set<string>();
  for (const cabecalho of extrator.getFileList().fileHeaders) {
    if (entradas.length >= limits.maxEntries) break;
    if (cabecalho.flags.directory) continue;
    const nome = cabecalho.name;
    // Mesma razão do .zip: a leitura é endereçada pelo nome, então nome
    // repetido não pode virar duas entradas.
    if (vistos.has(nome)) continue;
    vistos.add(nome);
    const size = cabecalho.unpSize;
    entradas.push({
      path: `${prefixo}${SEPARADOR}${nome}`,
      filename: nomeDe(nome),
      size,
      read: async () => {
        if (size > limits.maxEntryBytes) throw new Error(`"${nome}" passa do teto por arquivo.`);
        // Um extrator só serve para uma extração: o ponteiro do arquivo dentro
        // do WASM anda junto com a leitura.
        const leitor = await createExtractorFromData({ data: dados });
        for (const arquivo of leitor.extract({ files: [nome] }).files) {
          if (arquivo.extraction) return Buffer.from(arquivo.extraction);
        }
        throw new Error(`"${nome}" não pôde ser descompactado.`);
      },
    });
  }
  return entradas;
}
