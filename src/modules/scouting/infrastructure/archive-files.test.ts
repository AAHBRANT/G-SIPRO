import { crc32 } from "node:zlib";

import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";

import {
  archiveKind,
  listArchive,
  DEFAULT_ARCHIVE_LIMITS,
  type ArchiveLimits,
} from "@/modules/scouting/infrastructure/archive-files";
import type { DownloadedFile } from "@/modules/scouting/infrastructure/pncp-files-client";

/**
 * RAR de verdade, com três arquivos dentro, gerado uma vez e preso aqui em
 * base64. É de propósito: o formato é proprietário e não dá para montar um em
 * tempo de teste como se monta um .zip. Sem um RAR real, o caminho que o PNCP
 * de Pedra Preta exercita — .zip com .rar dentro — não estaria coberto por
 * teste nenhum, que é como ele passou despercebido até alguém abrir na mão.
 */
const RAR_BASE64 =
  "UmFyIRoHAQAzkrXlCgEFBgAFAQGAgAAl7vqFJgIDC5gABJgAIEVIR1eAAAAKRURJVEFMLnBkZgoDAu1WThA3O90BJVBERi0xLjQgY29ycG8gZG8gZWRpdGFs8fdk2kUCAwulAASlACDhjkUOgAAAKUp1c3RpZmljYXRpdmEgZGUgUXVhbGlmaWNhY2FvIFRlY25pY2EucGRmCgMC7VZOEDc73QElUERGLTEuNCBwYXJjZWxhcyBkZSBtYWlvciByZWxldmFuY2lhVtcV7ioCAwuIAASIACAXR7zwgAAADk9yY2FtZW50by54bHN4CgMC7VZOEDc73QFwbGFuaWxoYR13VlEDBQQA";

const RAR = Buffer.from(RAR_BASE64, "base64");

const baixado = (filename: string, bytes: Buffer): DownloadedFile => ({
  filename,
  mimeType: "application/octet-stream",
  bytes,
});

const zip = (conteudo: Record<string, Uint8Array>): Buffer => Buffer.from(zipSync(conteudo));

const caminhos = (entradas: ReadonlyArray<{ path: string }>): string[] => entradas.map((e) => e.path);

describe("reconhecimento do pacote", () => {
  it("reconhece pela extensão", () => {
    expect(archiveKind("199051_editais.zip")).toBe("zip");
    expect(archiveKind("ANEXOS DO EDITAL.rar")).toBe("rar");
    expect(archiveKind("EDITAL.pdf")).toBeNull();
  });

  /** O PNCP às vezes entrega o arquivo sem extensão no nome. */
  it("reconhece pela assinatura quando o nome não tem extensão", () => {
    expect(archiveKind("arquivo", zip({ "a.txt": strToU8("x") }))).toBe("zip");
    expect(archiveKind("arquivo", RAR)).toBe("rar");
    expect(archiveKind("arquivo", Buffer.from("%PDF-1.7 qualquer coisa"))).toBeNull();
  });
});

describe("listagem", () => {
  it("devolve vazio para arquivo que não é pacote", async () => {
    expect(await listArchive(baixado("EDITAL.pdf", Buffer.from("%PDF-1.4")))).toEqual([]);
  });

  it("lista o que há dentro de um .zip, sem os diretórios", async () => {
    const pacote = zip({
      "EDITAL.pdf": strToU8("%PDF edital"),
      "anexos/": new Uint8Array(0),
      "anexos/Termo de Referência.pdf": strToU8("%PDF termo"),
    });

    const entradas = await listArchive(baixado("pacote.zip", pacote));

    expect(caminhos(entradas)).toEqual([
      "pacote.zip → EDITAL.pdf",
      "pacote.zip → anexos/Termo de Referência.pdf",
    ]);
    expect(entradas.map((e) => e.filename)).toEqual(["EDITAL.pdf", "Termo de Referência.pdf"]);
  });

  it("abre um .rar", async () => {
    const entradas = await listArchive(baixado("ANEXOS DO EDITAL.rar", RAR));

    expect(entradas.map((e) => e.filename).sort()).toEqual([
      "EDITAL.pdf",
      "Justificativa de Qualificacao Tecnica.pdf",
      "Orcamento.xlsx",
    ]);
  });

  /** O caso do PNCP de Pedra Preta: .zip com um .rar dentro, e nada mais. */
  it("atravessa .zip com .rar dentro e mostra o caminho inteiro", async () => {
    const pacote = zip({ "ANEXOS DO EDITAL.rar": new Uint8Array(RAR) });

    const entradas = await listArchive(baixado("199051_editais.zip", pacote));

    expect(caminhos(entradas)).toContain(
      "199051_editais.zip → ANEXOS DO EDITAL.rar → Justificativa de Qualificacao Tecnica.pdf",
    );
    expect(entradas).toHaveLength(3);
  });

  it("devolve vazio quando o pacote está corrompido, em vez de estourar", async () => {
    const quebrado = Buffer.concat([Buffer.from("PK"), Buffer.alloc(64, 7)]);
    await expect(listArchive(baixado("pacote.zip", quebrado))).resolves.toEqual([]);
  });
});

describe("leitura de uma entrada", () => {
  it("só descompacta o que foi pedido", async () => {
    const pacote = zip({ "a.pdf": strToU8("conteúdo do a"), "b.pdf": strToU8("conteúdo do b") });

    const entradas = await listArchive(baixado("pacote.zip", pacote));
    const a = entradas.find((e) => e.filename === "a.pdf");

    expect(a?.size).toBe(strToU8("conteúdo do a").byteLength);
    expect((await a!.read()).toString("utf8")).toBe("conteúdo do a");
  });

  it("lê de dentro do .rar", async () => {
    const entradas = await listArchive(baixado("anexos.rar", RAR));
    const justificativa = entradas.find((e) => e.filename.startsWith("Justificativa"))!;

    expect((await justificativa.read()).toString("utf8")).toContain("parcelas de maior relevancia");
  });

  /**
   * ⚠️ Um extrator do unrar serve para UMA extração: o ponteiro do arquivo
   * dentro do WASM anda junto com a leitura. Reaproveitar o extrator da
   * listagem parece a dedup óbvia e deixa a suíte verde — mas em produção a
   * primeira leitura funciona e a SEGUNDA lança "File read error". No pacote de
   * Pedra Preta é exatamente a segunda (o EDITAL.pdf complementar) que cai, e o
   * serviço engole a exceção: consórcio, CAT e visita ficam em branco sem
   * ninguém saber por quê. Este teste é o que impede essa dedup.
   */
  it("lê duas entradas do mesmo .rar, uma depois da outra", async () => {
    const entradas = await listArchive(baixado("anexos.rar", RAR));
    const justificativa = entradas.find((e) => e.filename.startsWith("Justificativa"))!;
    const edital = entradas.find((e) => e.filename === "EDITAL.pdf")!;

    expect((await justificativa.read()).toString("utf8")).toContain("parcelas de maior relevancia");
    expect((await edital.read()).toString("utf8")).toContain("corpo do edital");
    // E de novo, fora de ordem: nenhuma leitura pode depender da anterior.
    expect((await justificativa.read()).toString("utf8")).toContain("parcelas de maior relevancia");
  });
});

describe("tetos", () => {
  const limites = (ajustes: Partial<ArchiveLimits>): ArchiveLimits => ({ ...DEFAULT_ARCHIVE_LIMITS, ...ajustes });

  it("não lista mais entradas do que o teto", async () => {
    const pacote = zip(Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`arquivo-${i}.pdf`, strToU8("x")]),
    ));

    const entradas = await listArchive(baixado("pacote.zip", pacote), limites({ maxEntries: 4 }));

    expect(entradas).toHaveLength(4);
  });

  /**
   * O teto por arquivo é conferido no cabeçalho, ANTES de inflar. É o que
   * separa recusar um anexo grande de estourar a memória do processo com um
   * .zip de 300 KB que declara gigabytes.
   */
  it("recusa a entrada que passa do teto sem descompactar", async () => {
    const pacote = zip({ "grande.pdf": strToU8("x".repeat(5000)) });

    const entradas = await listArchive(baixado("pacote.zip", pacote), limites({ maxEntryBytes: 100 }));

    expect(entradas).toHaveLength(1);
    await expect(entradas[0]!.read()).rejects.toThrow(/teto por arquivo/);
  });

  /**
   * A conferência gêmea dentro do .rar. Testar só o caminho do .zip dá a
   * impressão de que a proteção está coberta, e a linha do RAR pode ser apagada
   * com a suíte verde — deixando um .rar que declara 40 GB numa entrada ser
   * inflado direto na memória do container.
   */
  it("recusa a entrada do .rar que passa do teto, sem descompactar", async () => {
    const entradas = await listArchive(baixado("anexos.rar", RAR), limites({ maxEntryBytes: 10 }));

    expect(entradas.length).toBeGreaterThan(0);
    await expect(entradas[0]!.read()).rejects.toThrow(/teto por arquivo/);
  });

  it("não desce além da profundidade máxima", async () => {
    const interno = zip({ "EDITAL.pdf": strToU8("%PDF") });
    const externo = zip({ "interno.zip": new Uint8Array(interno) });

    expect(await listArchive(baixado("externo.zip", externo), limites({ maxDepth: 1 }))).toEqual([]);
    expect(await listArchive(baixado("externo.zip", externo), limites({ maxDepth: 2 }))).toHaveLength(1);
  });

  it("não materializa pacote aninhado que estoura o orçamento total", async () => {
    const interno = zip({ "EDITAL.pdf": strToU8("x".repeat(2000)) });
    const externo = zip({ "interno.zip": new Uint8Array(interno) });

    expect(await listArchive(baixado("externo.zip", externo), limites({ maxTotalBytes: 10 }))).toEqual([]);
  });

  /**
   * O orçamento é do pacote INTEIRO, somando os níveis. Sem a acumulação, cinco
   * anexos que passam sozinhos são materializados juntos no heap do container.
   */
  it("soma o que já gastou ao decidir o próximo pacote aninhado", async () => {
    const anexo = (marca: string) => new Uint8Array(zip({ [`${marca}.pdf`]: strToU8("x".repeat(400)) }));
    const um = anexo("a");
    const externo = zip({ "a.zip": um, "b.zip": anexo("b"), "c.zip": anexo("c") });

    // Orçamento para exatamente dois anexos: o terceiro só é recusado se o
    // gasto dos dois primeiros tiver sido somado.
    const entradas = await listArchive(baixado("externo.zip", externo), limites({ maxTotalBytes: um.byteLength * 2 }));

    expect(entradas.map((e) => e.filename)).toEqual(["a.pdf", "b.pdf"]);
  });

  /**
   * O teto por arquivo é conferido nos DOIS pontos, e conferir só o orçamento
   * antes de abrir o aninhado deixava passar um anexo que estourava lá dentro —
   * derrubando o pacote inteiro por causa de uma proteção que devia só pulá-lo.
   */
  it("pula o pacote aninhado grande demais sem perder o resto", async () => {
    const grande = new Uint8Array(zip({ "PRANCHAS.pdf": strToU8("x".repeat(3000)) }));
    const externo = zip({ "EDITAL.pdf": strToU8("%PDF"), "PROJETOS.zip": grande });

    // Teto por arquivo abaixo do anexo, mas orçamento total de sobra: só a
    // conferência do teto POR ARQUIVO antes de abrir o aninhado salva o edital.
    const entradas = await listArchive(
      baixado("externo.zip", externo),
      limites({ maxEntryBytes: grande.byteLength - 1 }),
    );

    expect(entradas.map((e) => e.filename)).toEqual(["EDITAL.pdf"]);
  });
});

/**
 * Um anexo ruim não pode custar o pacote.
 *
 * Antes disto, um único `.rar` corrompido no meio de 18 arquivos desenrolava a
 * recursão até o catch de `listArchive`, que devolve [] — e a licitação virava
 * NO_FILE tendo edital publicado e legível.
 */
describe("pacote parcialmente legível", () => {
  const bons = { "EDITAL.pdf": strToU8("%PDF edital"), "Justificativa.pdf": strToU8("%PDF parcelas") };

  it("mantém as entradas boas quando um anexo aninhado está corrompido", async () => {
    const pacote = zip({ ...bons, "FOTOS DA OBRA.rar": strToU8("nao sou um rar de verdade") });

    const entradas = await listArchive(baixado("pacote.zip", pacote));

    expect(entradas.map((e) => e.filename)).toEqual(["EDITAL.pdf", "Justificativa.pdf"]);
  });

  it("mantém as entradas boas quando o anexo ruim vem ANTES delas", async () => {
    const pacote = zip({ "00-quebrado.zip": strToU8("PK lixo"), ...bons });

    const entradas = await listArchive(baixado("pacote.zip", pacote));

    expect(entradas.map((e) => e.filename)).toEqual(["EDITAL.pdf", "Justificativa.pdf"]);
  });
});

/**
 * Amplificação por nome repetido.
 *
 * O formato .zip aceita N registros com o mesmo nome no índice. Como a leitura
 * é endereçada pelo nome, o filtro casava os N: o teto era conferido contra o
 * cabeçalho do primeiro e o fflate inflava todos. Medido antes da correção:
 * .zip de 33 KB virando 1.800 MB e ~4 s de event loop travado numa única
 * leitura — um jeito barato de derrubar o container a partir de arquivo público.
 *
 * `zipSync` não produz nomes repetidos (a entrada é um objeto), então o pacote
 * é montado byte a byte, sem compressão.
 */
describe("nome repetido dentro do pacote", () => {
  /** ZIP mínimo, método "store", com os nomes na ordem dada. */
  function zipCru(entradas: ReadonlyArray<readonly [string, string]>): Buffer {
    const locais: Buffer[] = [];
    const central: Buffer[] = [];
    let deslocamento = 0;

    for (const [nome, texto] of entradas) {
      const dados = Buffer.from(texto, "utf8");
      const nomeBytes = Buffer.from(nome, "utf8");
      const checagem = crc32(dados) >>> 0;

      const local = Buffer.alloc(30 + nomeBytes.length);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt32LE(checagem, 14);
      local.writeUInt32LE(dados.length, 18);
      local.writeUInt32LE(dados.length, 22);
      local.writeUInt16LE(nomeBytes.length, 26);
      nomeBytes.copy(local, 30);
      locais.push(local, dados);

      const registro = Buffer.alloc(46 + nomeBytes.length);
      registro.writeUInt32LE(0x02014b50, 0);
      registro.writeUInt16LE(20, 4);
      registro.writeUInt16LE(20, 6);
      registro.writeUInt32LE(checagem, 16);
      registro.writeUInt32LE(dados.length, 20);
      registro.writeUInt32LE(dados.length, 24);
      registro.writeUInt16LE(nomeBytes.length, 28);
      registro.writeUInt32LE(deslocamento, 42);
      nomeBytes.copy(registro, 46);
      central.push(registro);

      deslocamento += local.length + dados.length;
    }

    const dir = Buffer.concat(central);
    const fim = Buffer.alloc(22);
    fim.writeUInt32LE(0x06054b50, 0);
    fim.writeUInt16LE(entradas.length, 8);
    fim.writeUInt16LE(entradas.length, 10);
    fim.writeUInt32LE(dir.length, 12);
    fim.writeUInt32LE(deslocamento, 16);
    return Buffer.concat([...locais, dir, fim]);
  }

  const repetido = () => zipCru([
    ["a.pdf", "primeiro"],
    ["a.pdf", "segundo-bem-mais-longo-do-que-o-primeiro"],
    ["a.pdf", "terceiro"],
  ]);

  it("lista o nome uma vez só", async () => {
    const entradas = await listArchive(baixado("pacote.zip", repetido()));
    expect(entradas.map((e) => e.filename)).toEqual(["a.pdf"]);
  });

  it("infla uma entrada só, do tamanho declarado no cabeçalho", async () => {
    const entradas = await listArchive(baixado("pacote.zip", repetido()));
    const lido = await entradas[0]!.read();

    expect(lido.byteLength).toBe(entradas[0]!.size);
    expect(lido.toString("utf8")).toBe("primeiro");
  });
});
