import { describe, expect, it, vi } from "vitest";

import type { AuthorizationContext } from "@/core/authorization/policy";
import {
  EditalReadingService,
  type EditalArchivePort,
  type EditalExtractionPort,
  type EditalReadingRepository,
  type TenderFilesPort,
} from "@/modules/scouting/application/edital-reading-service";
import type { DownloadedFile, TenderFile } from "@/modules/scouting/infrastructure/pncp-files-client";

const auth = { actorId: "11111111-1111-1111-1111-111111111111" } as unknown as AuthorizationContext;

const arquivo = (parcial: Partial<TenderFile> = {}): TenderFile => ({
  title: "Edital 14/2026", documentType: "Edital", url: "https://pncp.gov.br/arquivos/1", sequence: 1, ...parcial,
});

const baixado = (parcial: Partial<DownloadedFile> = {}): DownloadedFile => ({
  filename: "edital.pdf", mimeType: "application/pdf", bytes: Buffer.from("conteudo do edital"), ...parcial,
});

/** Saída da extração no formato que o repositório real devolve. */
const saida = (campos: Array<{ field: string; value: string }>, extras: Record<string, unknown> = {}) => ({
  output: { content: campos, confidence: 0.82, limitations: [], ...extras },
});

function montar(ajustes: {
  files?: Partial<TenderFilesPort>;
  archive?: Partial<EditalArchivePort>;
  extraction?: Partial<EditalExtractionPort>;
  readings?: Partial<EditalReadingRepository>;
} = {}) {
  const files: TenderFilesPort = {
    list: vi.fn(async () => [arquivo()]),
    download: vi.fn(async () => baixado()),
    ...ajustes.files,
  };
  const archive: EditalArchivePort = {
    findVersionByHash: vi.fn(async () => undefined),
    archive: vi.fn(async () => ({ versionId: "v-1" })),
    ...ajustes.archive,
  };
  const extraction: EditalExtractionPort = {
    approvedDefinition: vi.fn(async () => ({ id: "def-1", promptHash: "a".repeat(64) })),
    run: vi.fn(async () => saida([
      { field: "Parcelas de maior relevância e quantitativos mínimos", value: "Ponte em concreto armado — 15 m" },
      { field: "Consórcio", value: "Permitido" },
    ])),
    ...ajustes.extraction,
  };
  const readings: EditalReadingRepository = {
    tender: vi.fn(async () => ({ id: "t-1", externalId: "07658917000127-1-000114/2025", title: "Ponte sobre o rio" })),
    find: vi.fn(async () => undefined),
    save: vi.fn(async (input) => ({ ...input })),
    ...ajustes.readings,
  };
  return { service: new EditalReadingService(files, archive, extraction, readings), files, archive, extraction, readings };
}

describe("leitura que dá certo", () => {
  it("baixa, arquiva, extrai e grava a exigência", async () => {
    const { service, readings } = montar();
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("READ");
    if (outcome.status !== "READ") return;
    expect(outcome.reading.requirement.services[0]?.description).toContain("Ponte");
    expect(outcome.reading.requirement.services[0]?.quantity).toBe(15);
    expect(outcome.reading.requirement.consortiumAllowed).toBe(true);
    expect(readings.save).toHaveBeenCalledOnce();
  });

  it("aproveita o arquivo já no acervo em vez de duplicá-lo", async () => {
    const { service, archive } = montar({ archive: { findVersionByHash: vi.fn(async () => ({ id: "v-antiga" })) } });
    await service.read("t-1", auth);

    expect(archive.archive).not.toHaveBeenCalled();
  });

  /**
   * O primeiro da lista é o termo de referência, mas nem sempre é PDF. Parar
   * nele deixaria a licitação sem leitura tendo o edital logo abaixo.
   */
  it("pula o que não é PDF e fica com o próximo", async () => {
    const { service, archive } = montar({
      files: {
        list: vi.fn(async () => [arquivo({ title: "Projeto" }), arquivo({ title: "Edital", sequence: 2 })]),
        download: vi.fn(async (file: TenderFile) => file.title === "Projeto"
          ? baixado({ filename: "projeto.zip", mimeType: "application/zip" })
          : baixado()),
      },
    });
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("READ");
    expect(vi.mocked(archive.archive).mock.calls[0]?.[0].filename).toBe("edital.pdf");
  });
});

describe("o que impede a leitura devolve motivo, e não exceção", () => {
  it("licitação já lida não é lida de novo", async () => {
    const { service, files, extraction } = montar({
      readings: { find: vi.fn(async () => ({ tenderId: "t-1", documentVersionId: "v-1", requirement: { services: [], limitations: [] } })) },
    });
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("ALREADY_READ");
    // O ponto do teste: nem PNCP nem IA são acionados. Reler custa dinheiro.
    expect(files.list).not.toHaveBeenCalled();
    expect(extraction.run).not.toHaveBeenCalled();
  });

  /**
   * Sem caso de uso aprovado a leitura não pode acontecer — e não pode nem
   * começar: baixar o edital para descobrir depois que não há autorização
   * gastaria banda e gravaria arquivo sem amparo.
   */
  it("sem caso de uso aprovado, para antes de baixar qualquer coisa", async () => {
    const { service, files, archive } = montar({ extraction: { approvedDefinition: vi.fn(async () => undefined) } });
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("NOT_CONFIGURED");
    expect(files.list).not.toHaveBeenCalled();
    expect(archive.archive).not.toHaveBeenCalled();
  });

  it("número de controle fora do padrão não vira pedido ao PNCP", async () => {
    const { service, files } = montar({
      readings: { tender: vi.fn(async () => ({ id: "t-1", externalId: "sem-formato", title: "Obra" })) },
    });
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("NO_IDENTIFIER");
    expect(files.list).not.toHaveBeenCalled();
  });

  it("licitação sem arquivo publicado", async () => {
    const { service } = montar({ files: { list: vi.fn(async () => []) } });
    expect((await service.read("t-1", auth)).status).toBe("NO_FILE");
  });

  it("anexo grande demais é dito pelo nome", async () => {
    const { service } = montar({
      files: { list: vi.fn(async () => [arquivo({ title: "Projeto executivo" })]), download: vi.fn(async () => null) },
    });
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("FILE_TOO_LARGE");
    if (outcome.status === "FILE_TOO_LARGE") expect(outcome.title).toBe("Projeto executivo");
  });

  /**
   * Gravar uma leitura vazia seria pior do que não ler: a tela leria "nenhuma
   * parcela exigida" e daria 100% de aderência para qualquer empresa.
   */
  it("extração que não achou nada não vira leitura gravada", async () => {
    const { service, readings } = montar({ extraction: { run: vi.fn(async () => saida([{ field: "Objeto", value: "—" }])) } });
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("NOTHING_EXTRACTED");
    expect(readings.save).not.toHaveBeenCalled();
  });

  it("PNCP fora do ar devolve falha, sem derrubar o lote", async () => {
    const { service } = montar({ files: { list: vi.fn(async () => { throw new Error("PNCP respondeu 500 ao listar arquivos."); }) } });
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("FAILED");
    if (outcome.status === "FAILED") expect(outcome.reason).toContain("500");
  });

  it("licitação inexistente", async () => {
    const { service } = montar({ readings: { tender: vi.fn(async () => undefined) } });
    expect((await service.read("nao-existe", auth)).status).toBe("TENDER_NOT_FOUND");
  });
});

describe("chave de idempotência", () => {
  const chaveDe = async (ajustes: Parameters<typeof montar>[0] = {}) => {
    const { service, extraction } = montar(ajustes);
    await service.read("t-1", auth);
    return vi.mocked(extraction.run).mock.calls[0]?.[0].idempotencyKey ?? "";
  };

  it("cabe no limite de 120 caracteres do schema", async () => {
    expect((await chaveDe()).length).toBeLessThanOrEqual(120);
  });

  /** Mesmo arquivo e mesmo prompt: a segunda chamada reaproveita, não paga. */
  it("é a mesma para o mesmo arquivo e o mesmo prompt", async () => {
    expect(await chaveDe()).toBe(await chaveDe());
  });

  it("muda quando o conteúdo do arquivo muda", async () => {
    const outra = await chaveDe({ files: { download: vi.fn(async () => baixado({ bytes: Buffer.from("outro edital") })) } });
    expect(outra).not.toBe(await chaveDe());
  });

  /**
   * Sem isto, corrigir o prompt e mandar reler esbarraria na idempotência da
   * chamada antiga — o serviço lançaria "chave já utilizada para outra entrada"
   * em vez de reler.
   */
  it("muda quando o prompt muda", async () => {
    const outra = await chaveDe({ extraction: { approvedDefinition: vi.fn(async () => ({ id: "def-2", promptHash: "b".repeat(64) })) } });
    expect(outra).not.toBe(await chaveDe());
  });
});
