import { describe, expect, it, vi } from "vitest";

import { filenameFromDisposition, mimeFromFilename, PncpFilesClient } from "@/modules/scouting/infrastructure/pncp-files-client";

const lista = (registros: unknown) =>
  new Response(JSON.stringify(registros), { status: 200, headers: { "content-type": "application/json" } });

const arquivo = (bytes: Buffer, disposition?: string, contentLength?: number) =>
  // Uint8Array e não Buffer: o tipo de BodyInit não aceita Buffer.
  new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      ...(disposition ? { "content-disposition": disposition } : {}),
      ...(contentLength !== undefined ? { "content-length": String(contentLength) } : {}),
    },
  });

describe("filenameFromDisposition", () => {
  it("lê o nome verdadeiro do cabeçalho", () => {
    // O corpo vem como octet-stream: o nome só existe aqui.
    expect(filenameFromDisposition('attachment; filename="EDITAL_2025.pdf"', "x.pdf")).toBe("EDITAL_2025.pdf");
  });

  it("aceita nome sem aspas", () => {
    expect(filenameFromDisposition("attachment; filename=TR.pdf", "x.pdf")).toBe("TR.pdf");
  });

  it("decodifica nome com acento percent-encoded", () => {
    expect(filenameFromDisposition("attachment; filename*=UTF-8''Termo%20de%20Refer%C3%AAncia.pdf", "x.pdf"))
      .toBe("Termo de Referência.pdf");
  });

  it("não perde o arquivo por causa de escape inválido", () => {
    // Nome mal formado não justifica desistir do download.
    expect(filenameFromDisposition('attachment; filename="100%.pdf"', "x.pdf")).toBe("100%.pdf");
  });

  it("cai no nome de reserva quando o cabeçalho não vem", () => {
    expect(filenameFromDisposition(null, "reserva.pdf")).toBe("reserva.pdf");
  });
});

describe("mimeFromFilename", () => {
  it.each([
    ["EDITAL.pdf", "application/pdf"],
    ["anexo.PDF", "application/pdf"],
    ["tr.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["projeto.zip", "application/zip"],
    ["sem-extensao", "application/octet-stream"],
  ])("%s → %s", (nome, esperado) => {
    expect(mimeFromFilename(nome)).toBe(esperado);
  });
});

describe("PncpFilesClient.list", () => {
  it("devolve os arquivos com título, tipo e endereço", async () => {
    const fetchImpl = vi.fn(async () => lista([
      { titulo: "EDITAL", tipoDocumentoNome: "Edital", url: "https://exemplo/1", sequencialDocumento: 1 },
    ]));
    const files = await new PncpFilesClient({ fetchImpl: fetchImpl as unknown as typeof fetch })
      .list("07658917000127", 2025, 114);

    expect(files).toEqual([{ title: "EDITAL", documentType: "Edital", url: "https://exemplo/1", sequence: 1 }]);
  });

  /**
   * A ordem importa mais do que parece: em obra grande a lista de parcelas de
   * maior relevância costuma estar no termo de referência ou no projeto básico,
   * não no edital. Ler só o primeiro arquivo deixaria o quantitativo de fora.
   */
  it("põe termo de referência e projeto básico na frente do edital", async () => {
    const fetchImpl = vi.fn(async () => lista([
      { titulo: "Anexo VII - planilha", tipoDocumentoNome: "Anexo", url: "https://exemplo/4", sequencialDocumento: 4 },
      { titulo: "EDITAL", tipoDocumentoNome: "Edital", url: "https://exemplo/1", sequencialDocumento: 1 },
      { titulo: "Projeto básico", tipoDocumentoNome: "Outros Documentos", url: "https://exemplo/3", sequencialDocumento: 3 },
      { titulo: "Termo de Referência", tipoDocumentoNome: "Termo de Referência", url: "https://exemplo/2", sequencialDocumento: 2 },
    ]));
    const files = await new PncpFilesClient({ fetchImpl: fetchImpl as unknown as typeof fetch }).list("x", 2025, 1);

    expect(files.map((f) => f.title)).toEqual(["Termo de Referência", "Projeto básico", "EDITAL", "Anexo VII - planilha"]);
  });

  it("reconhece o tipo pelo título quando o órgão não classifica direito", async () => {
    const fetchImpl = vi.fn(async () => lista([
      { titulo: "Outro documento", tipoDocumentoNome: "Outros", url: "https://exemplo/2", sequencialDocumento: 2 },
      { titulo: "TERMO DE REFERENCIA CONSOLIDADO", tipoDocumentoNome: "Outros", url: "https://exemplo/1", sequencialDocumento: 1 },
    ]));
    const files = await new PncpFilesClient({ fetchImpl: fetchImpl as unknown as typeof fetch }).list("x", 2025, 1);
    expect(files[0]?.title).toContain("TERMO DE REFERENCIA");
  });

  it("trata licitação sem arquivo publicado como lista vazia, não como erro", async () => {
    // Acontece: o órgão às vezes publica o edital só na plataforma de disputa.
    for (const status of [404, 204]) {
      const fetchImpl = vi.fn(async () => new Response(null, { status }));
      const files = await new PncpFilesClient({ fetchImpl: fetchImpl as unknown as typeof fetch }).list("x", 2025, 1);
      expect(files).toEqual([]);
    }
  });

  it("descarta registro sem endereço em vez de devolver item quebrado", async () => {
    const fetchImpl = vi.fn(async () => lista([
      { titulo: "sem url", tipoDocumentoNome: "Edital" },
      { titulo: "com url", tipoDocumentoNome: "Edital", url: "https://exemplo/1" },
    ]));
    const files = await new PncpFilesClient({ fetchImpl: fetchImpl as unknown as typeof fetch }).list("x", 2025, 1);
    expect(files).toHaveLength(1);
    expect(files[0]?.title).toBe("com url");
  });

  it("avisa quando o portal falha, em vez de fingir que não há arquivo", async () => {
    const fetchImpl = vi.fn(async () => new Response("erro", { status: 500 }));
    await expect(new PncpFilesClient({ fetchImpl: fetchImpl as unknown as typeof fetch }).list("x", 2025, 1))
      .rejects.toThrow(/500/);
  });
});

describe("PncpFilesClient.download", () => {
  const alvo = { title: "EDITAL", documentType: "Edital", url: "https://exemplo/1", sequence: 1 };

  it("devolve o arquivo com nome e tipo deduzidos", async () => {
    const bytes = Buffer.from("%PDF-1.7 conteúdo");
    const fetchImpl = vi.fn(async () => arquivo(bytes, 'attachment; filename="EDITAL_2025.pdf"'));
    const baixado = await new PncpFilesClient({ fetchImpl: fetchImpl as unknown as typeof fetch }).download(alvo);

    expect(baixado?.filename).toBe("EDITAL_2025.pdf");
    expect(baixado?.mimeType).toBe("application/pdf");
    expect(baixado?.bytes.toString()).toContain("%PDF");
  });

  /**
   * Anexo de projeto com centenas de pranchas passa de 100 MB. Baixar para a
   * memória derrubaria o processo — e o arquivo que interessa não é esse.
   */
  it("recusa arquivo acima do teto pelo cabeçalho, sem baixar", async () => {
    const fetchImpl = vi.fn(async () => arquivo(Buffer.alloc(10), undefined, 99_000_000));
    const baixado = await new PncpFilesClient({ fetchImpl: fetchImpl as unknown as typeof fetch, maxFileBytes: 1_000_000 })
      .download(alvo);
    expect(baixado).toBeNull();
  });

  it("recusa também quando o tamanho só aparece depois de baixar", async () => {
    // Nem todo servidor declara content-length.
    const fetchImpl = vi.fn(async () => arquivo(Buffer.alloc(2_000_000)));
    const baixado = await new PncpFilesClient({ fetchImpl: fetchImpl as unknown as typeof fetch, maxFileBytes: 1_000_000 })
      .download(alvo);
    expect(baixado).toBeNull();
  });

  it("avisa quando o download falha", async () => {
    const fetchImpl = vi.fn(async () => new Response("nao encontrado", { status: 404 }));
    await expect(new PncpFilesClient({ fetchImpl: fetchImpl as unknown as typeof fetch }).download(alvo))
      .rejects.toThrow(/404/);
  });
});
