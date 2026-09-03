import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

import type { AuthorizationContext } from "@/core/authorization/policy";
import {
  EditalReadingService,
  mergeReadings,
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

/** Execução como o repositório real a devolve: id, saída, confiança, limitações. */
const execucao = (campos: Array<{ field: string; value: string }>, extras: Record<string, unknown> = {}) => ({
  id: "exec-1",
  output: { content: campos },
  confidence: 0.82,
  limitations: [],
  ...extras,
});

function montar(ajustes: {
  files?: Partial<TenderFilesPort>;
  extraction?: Partial<EditalExtractionPort>;
  readings?: Partial<EditalReadingRepository>;
} = {}) {
  const files: TenderFilesPort = {
    list: vi.fn(async () => [arquivo()]),
    download: vi.fn(async () => baixado()),
    ...ajustes.files,
  };
  const extraction: EditalExtractionPort = {
    approvedDefinition: vi.fn(async () => ({ id: "def-1", promptHash: "a".repeat(64) })),
    runEphemeral: vi.fn(async () => execucao([
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
  return { service: new EditalReadingService(files, extraction, readings), files, extraction, readings };
}

describe("leitura que dá certo", () => {
  it("baixa, lê e grava a exigência", async () => {
    const { service, readings } = montar();
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("READ");
    if (outcome.status !== "READ") return;
    expect(outcome.reading.requirement.services[0]?.description).toContain("Ponte");
    expect(outcome.reading.requirement.services[0]?.quantity).toBe(15);
    expect(outcome.reading.requirement.consortiumAllowed).toBe(true);
    expect(readings.save).toHaveBeenCalledOnce();
  });

  /**
   * O PDF não é preservado: o que fica é o endereço — que é o link de download
   * do cartão — e o SHA-256 do que foi lido, que denuncia edital retificado.
   */
  it("guarda a origem e o hash, e nenhum arquivo", async () => {
    const { service } = montar();
    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    expect(outcome.reading.source.uri).toBe("https://pncp.gov.br/arquivos/1");
    expect(outcome.reading.source.filename).toBe("edital.pdf");
    expect(outcome.reading.source.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(outcome.reading.executionId).toBe("exec-1");
  });

  it("o endereço gravado é o do arquivo escolhido, não o do primeiro da lista", async () => {
    const { service } = montar({
      files: {
        list: vi.fn(async () => [arquivo({ title: "Projeto", url: "https://pncp.gov.br/arquivos/9" }), arquivo({ title: "Edital", url: "https://pncp.gov.br/arquivos/2", sequence: 2 })]),
        download: vi.fn(async (file: TenderFile) => file.title === "Projeto"
          ? baixado({ filename: "projeto.zip", mimeType: "application/zip" })
          : baixado()),
      },
    });
    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    expect(outcome.reading.source.uri).toBe("https://pncp.gov.br/arquivos/2");
  });

  it("declara o tipo documental à governança, e não deixa vir de fora", async () => {
    const { service, extraction } = montar();
    await service.read("t-1", auth);
    expect(vi.mocked(extraction.runEphemeral).mock.calls[0]?.[0].source.documentType).toBe("EDITAL");
  });
});

describe("o que impede a leitura devolve motivo, e não exceção", () => {
  it("licitação já lida não é lida de novo", async () => {
    const { service, files, extraction } = montar({
      readings: {
        find: vi.fn(async () => ({
          tenderId: "t-1", executionId: "exec-0",
          source: { uri: "https://x", filename: "e.pdf", fileHash: "a".repeat(64), fetchedAt: new Date() },
          requirement: { services: [], limitations: [] },
        })),
      },
    });
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("ALREADY_READ");
    // O ponto do teste: nem PNCP nem IA são acionados. Reler custa dinheiro.
    expect(files.list).not.toHaveBeenCalled();
    expect(extraction.runEphemeral).not.toHaveBeenCalled();
  });

  /**
   * Sem caso de uso aprovado a leitura não pode acontecer — e não pode nem
   * começar: baixar 12 MB para descobrir depois que não há autorização
   * gastaria banda à toa.
   */
  it("sem caso de uso aprovado, para antes de baixar qualquer coisa", async () => {
    const { service, files } = montar({ extraction: { approvedDefinition: vi.fn(async () => undefined) } });
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("NOT_CONFIGURED");
    expect(files.list).not.toHaveBeenCalled();
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
    const { service, readings } = montar({ extraction: { runEphemeral: vi.fn(async () => execucao([{ field: "Objeto", value: "—" }])) } });
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("NOTHING_EXTRACTED");
    expect(readings.save).not.toHaveBeenCalled();
  });

  /** Sem identificador da execução não há como reencontrar a fonte depois. */
  it("execução sem identificador não vira leitura gravada", async () => {
    const { service, readings } = montar({ extraction: { runEphemeral: vi.fn(async () => ({ output: { content: [{ field: "Consórcio", value: "Permitido" }] } })) } });
    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("FAILED");
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
    return vi.mocked(extraction.runEphemeral).mock.calls[0]?.[0].idempotencyKey ?? "";
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

/**
 * O caso que motivou tudo: Concorrência 17/2026 de Pedra Preta/MT.
 *
 * O órgão publicou UM arquivo — um .zip de 19,5 MB com um .rar dentro — e as
 * seis parcelas de maior relevância, com quantitativo, estavam na
 * "Justificativa de Qualificação Técnica", não no edital. Antes disto o serviço
 * via `application/zip`, não reconhecia como PDF e devolvia NO_FILE.
 */
describe("licitação publicada como pacote compactado", () => {
  const pdf = (texto: string) => strToU8(`%PDF-1.4 ${texto}`);

  const pacote = (conteudo: Record<string, Uint8Array>): DownloadedFile => ({
    filename: "199051_editais_1787665929.zip",
    mimeType: "application/zip",
    bytes: Buffer.from(zipSync(conteudo)),
  });

  const pacoteDePedraPreta = () => pacote({
    "PROJETOS.pdf": pdf("pranchas"),
    "EDITAL.pdf": pdf("consorcio vedado"),
    "Justificativa de Qualificação Técnica (2).pdf": pdf("parcelas de maior relevancia"),
    "Orcamento analitico.xlsx": strToU8("planilha"),
  });

  /** Devolve uma extração diferente conforme o arquivo que chegou para ler. */
  const porArquivo = (respostas: Record<string, ReturnType<typeof execucao>>) =>
    vi.fn(async (entrada: { source: { filename: string } }) => {
      const chave = Object.keys(respostas).find((nome) => entrada.source.filename.includes(nome));
      if (!chave) throw new Error(`não esperava ler "${entrada.source.filename}"`);
      return respostas[chave]!;
    });

  it("abre o pacote e lê a justificativa de qualificação técnica, não as pranchas", async () => {
    const runEphemeral = porArquivo({
      Justificativa: execucao([
        { field: "Parcelas de maior relevância e quantitativos mínimos", value: "Pavimento em TSD — 3.528,80 m2" },
      ]),
      "EDITAL.pdf": execucao([{ field: "Permite consórcio", value: "Vedada a participação de consórcio" }]),
    });
    const { service } = montar({
      files: { download: vi.fn(async () => pacoteDePedraPreta()) },
      extraction: { runEphemeral },
    });

    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    expect(outcome.reading.requirement.services[0]?.description).toContain("TSD");
    expect(outcome.reading.requirement.services[0]?.quantity).toBe(3528.8);
  });

  /**
   * O quantitativo mora no anexo e o consórcio no edital. Ler um só deixaria
   * metade da resposta de fora — e é por isso que a leitura pode gastar duas
   * chamadas quando a primeira não fecha consórcio, CAT e visita.
   */
  it("completa com o edital o que a justificativa não responde", async () => {
    const runEphemeral = porArquivo({
      Justificativa: execucao([
        { field: "Parcelas de maior relevância e quantitativos mínimos", value: "Pavimento em TSD — 3.528,80 m2" },
      ]),
      "EDITAL.pdf": execucao([
        { field: "Permite consórcio", value: "Vedada a participação de consórcio" },
        { field: "Exige atestado registrado no CREA/CAU (CAT)", value: "Sim, com registro no CREA" },
      ]),
    });
    const { service } = montar({
      files: { download: vi.fn(async () => pacoteDePedraPreta()) },
      extraction: { runEphemeral },
    });

    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    expect(runEphemeral).toHaveBeenCalledTimes(2);
    expect(outcome.reading.requirement.consortiumAllowed).toBe(false);
    expect(outcome.reading.requirement.requiresCat).toBe(true);
    expect(outcome.reading.requirement.services).toHaveLength(1);
    expect(outcome.reading.requirement.limitations.join(" ")).toContain("EDITAL.pdf");
  });

  /**
   * O link do cartão é o do arquivo PUBLICADO — é o .zip que a pessoa baixa. O
   * nome guardado é o caminho de dentro, para quem conferir na mão saber em
   * qual dos 18 arquivos a exigência foi lida.
   */
  it("guarda o endereço do pacote e o caminho de dentro dele", async () => {
    const { service } = montar({
      files: {
        list: vi.fn(async () => [arquivo({ url: "https://pncp.gov.br/arquivos/7", documentType: "Anexo" })]),
        download: vi.fn(async () => pacote({ "EDITAL.pdf": pdf("corpo") })),
      },
    });

    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    expect(outcome.reading.source.uri).toBe("https://pncp.gov.br/arquivos/7");
    expect(outcome.reading.source.filename).toBe("199051_editais_1787665929.zip → EDITAL.pdf");
  });

  /**
   * Uma leitura só quando o próprio edital é o melhor documento do pacote.
   *
   * O pacote traz DOIS documentos que são o edital de propósito: sem isso o
   * `find` do complemento não acharia nada de qualquer jeito, e o teste passaria
   * com a guarda removida — afirmando proteger o que não protege.
   */
  it("não gasta a segunda chamada quando o principal já é o edital", async () => {
    const { service, extraction } = montar({
      files: {
        download: vi.fn(async () => pacote({
          "EDITAL.pdf": pdf("corpo"),
          "ANEXO I - EDITAL.pdf": pdf("mesmo edital, outro nome"),
          "PROJETOS.pdf": pdf("pranchas"),
        })),
      },
    });

    await service.read("t-1", auth);

    expect(extraction.runEphemeral).toHaveBeenCalledOnce();
  });

  /**
   * O peso do edital não é fixo: ele é o MÍNIMO entre os padrões que casaram.
   * Um edital chamado "EDITAL PREGAO 17-2026 TR.pdf" sai com o peso do termo de
   * referência e continua sendo o edital — procurar o complemento comparando o
   * número deixava consórcio, CAT e visita em branco, sem erro nenhum.
   */
  it("acha o edital como complemento mesmo quando o peso dele é outro", async () => {
    const runEphemeral = porArquivo({
      Justificativa: execucao([
        { field: "Parcelas de maior relevância e quantitativos mínimos", value: "Pavimento em TSD — 3.528,80 m2" },
      ]),
      "EDITAL PREGAO": execucao([{ field: "Permite consórcio", value: "Vedada a participação de consórcio" }]),
    });
    const { service } = montar({
      files: {
        download: vi.fn(async () => pacote({
          "Justificativa de Qualificação Técnica.pdf": pdf("parcelas"),
          "EDITAL PREGAO 17-2026 TR.pdf": pdf("consorcio vedado"),
        })),
      },
      extraction: { runEphemeral },
    });

    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    expect(runEphemeral).toHaveBeenCalledTimes(2);
    expect(outcome.reading.requirement.consortiumAllowed).toBe(false);
  });

  /**
   * Perder o complemento não pode custar as parcelas já lidas: sem isto, uma
   * falha na segunda chamada jogaria fora a leitura que interessa.
   */
  it("mantém a leitura principal quando o complemento falha", async () => {
    const runEphemeral = vi.fn(async (entrada: { source: { filename: string } }) => {
      if (entrada.source.filename.includes("EDITAL")) throw new Error("provedor fora do ar");
      return execucao([
        { field: "Parcelas de maior relevância e quantitativos mínimos", value: "Pavimento em TSD — 3.528,80 m2" },
      ]);
    });
    const { service } = montar({
      files: { download: vi.fn(async () => pacoteDePedraPreta()) },
      extraction: { runEphemeral },
    });

    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    // Qual arquivo foi lido, e não só "algum": sem isto o teste passaria com o
    // serviço escolhendo as pranchas de 17,9 MB como principal.
    expect(outcome.reading.source.filename).toContain("Justificativa");
    expect(outcome.reading.requirement.services).toHaveLength(1);
    expect(outcome.reading.requirement.consortiumAllowed).toBeUndefined();
  });

  it("devolve NO_FILE quando o pacote não tem PDF nenhum", async () => {
    const { service } = montar({
      files: { download: vi.fn(async () => pacote({ "Orcamento.xlsx": strToU8("planilha") })) },
    });

    expect((await service.read("t-1", auth)).status).toBe("NO_FILE");
  });

  /**
   * O `sourceFilename` é VarChar(255) no banco e `shortText(255)` no zod. O
   * caminho de dentro do pacote passa disso com facilidade, e o corte tem de
   * ser pelo COMEÇO: é o fim que identifica o documento.
   */
  it("corta o nome longo pelo começo, preservando o do arquivo", async () => {
    const fundo = `03 - PROJETO BASICO/${"06 - MEMORIAIS/".repeat(20)}MEMORIAL DESCRITIVO.pdf`;
    const { service } = montar({
      files: { download: vi.fn(async () => pacote({ [fundo]: pdf("memorial") })) },
    });

    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    expect(outcome.reading.source.filename.length).toBeLessThanOrEqual(255);
    expect(outcome.reading.source.filename).toMatch(/MEMORIAL DESCRITIVO\.pdf$/);
    expect(outcome.reading.source.filename.startsWith("…")).toBe(true);
  });
});

/**
 * O que acontece quando um dos arquivos não colabora.
 *
 * Cada um destes casos, antes, custava a licitação inteira — e sempre pelo
 * mesmo jeito: a exceção subia, o desfecho virava NO_FILE ou FAILED, e a tela
 * dizia "a conferir" sobre uma licitação cujo edital estava publicado e legível.
 */
describe("um arquivo ruim não custa a licitação", () => {
  const pdf = (texto: string) => strToU8(`%PDF-1.4 ${texto}`);
  const zipDe = (conteudo: Record<string, Uint8Array>, filename = "pacote.zip"): DownloadedFile => ({
    filename, mimeType: "application/zip", bytes: Buffer.from(zipSync(conteudo)),
  });
  const pdfSolto = (filename: string): DownloadedFile => ({
    filename, mimeType: "application/pdf", bytes: Buffer.from(pdf("corpo")),
  });
  const outroTipo = (filename: string): DownloadedFile => ({
    filename, mimeType: "application/msword", bytes: Buffer.from("nao sou pdf"),
  });

  /**
   * O teto de download só pode valer DEPOIS de já haver algo legível na fila.
   * Dois .docx e um .dwg na frente do edital é combinação banal, e parar no
   * terceiro abandonava a licitação — coisa que o laço antigo nunca fazia.
   */
  it("continua baixando enquanto não tem nenhum PDF em mãos", async () => {
    const publicados = [
      arquivo({ title: "Termo de Referência", url: "u1", sequence: 1 }),
      arquivo({ title: "Projeto Básico", url: "u2", sequence: 2 }),
      arquivo({ title: "Projeto Executivo", url: "u3", sequence: 3 }),
      arquivo({ title: "Edital", url: "u4", sequence: 4 }),
    ];
    const download = vi.fn(async (f: { url: string }) =>
      f.url === "u4" ? pdfSolto("EDITAL.pdf") : outroTipo("Termo de Referência.docx"));
    const { service } = montar({ files: { list: vi.fn(async () => publicados), download } });

    const outcome = await service.read("t-1", auth);

    expect(outcome.status).toBe("READ");
    expect(download).toHaveBeenCalledTimes(4);
  });

  /** O PNCP responde 502 num anexo com frequência. */
  it("segue em frente quando o download de um candidato explode", async () => {
    const publicados = [
      arquivo({ title: "Justificativa de Qualificação Técnica", url: "u1", sequence: 1 }),
      arquivo({ title: "Projeto Básico", url: "u2", sequence: 2 }),
      arquivo({ title: "Edital", url: "u3", sequence: 3 }),
    ];
    const download = vi.fn(async (f: { url: string }) => {
      if (f.url === "u2") throw new Error('PNCP respondeu 502 ao baixar "Projeto Básico".');
      return pdfSolto(f.url === "u1" ? "Justificativa de Qualificação Técnica.pdf" : "EDITAL.pdf");
    });
    const { service } = montar({ files: { list: vi.fn(async () => publicados), download } });

    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    expect(outcome.reading.source.filename).toContain("Justificativa");
  });

  /**
   * A listagem só lê cabeçalhos: descompactar é o primeiro momento em que o
   * conteúdo do membro é tocado. Um anexo grande demais aparece na fila
   * normalmente e só estoura aqui — e cair fora nesse ponto descartaria a
   * licitação com o EDITAL.pdf legível logo atrás.
   */
  it("passa para o próximo da fila quando o escolhido não descompacta", async () => {
    const gigante = strToU8("x".repeat(41 * 1024 * 1024));
    const { service } = montar({
      files: {
        download: vi.fn(async () => zipDe({
          "Justificativa de Qualificação Técnica.pdf": gigante,
          "EDITAL.pdf": pdf("corpo do edital"),
        })),
      },
    });

    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    expect(outcome.reading.source.filename).toContain("EDITAL.pdf");
  });

  /**
   * Quando o provedor falha na primeira leitura, a linha volta com status
   * FAILED e sem saída. Gravar o rastro de auditoria apontando para ela diria
   * que a exigência veio de uma leitura que não leu nada — o conteúdo veio todo
   * da segunda.
   */
  it("grava a execução que produziu o conteúdo, não a que falhou", async () => {
    const runEphemeral = vi.fn(async (entrada: { source: { filename: string } }) =>
      entrada.source.filename.includes("Justificativa")
        ? { id: "exec-falha", status: "FAILED", output: null, confidence: null, limitations: [] }
        : { ...execucao([{ field: "Permite consórcio", value: "Vedada" }]), id: "exec-boa" });
    const { service } = montar({
      files: {
        download: vi.fn(async () => zipDe({
          "Justificativa de Qualificação Técnica.pdf": pdf("parcelas"),
          "EDITAL.pdf": pdf("consorcio vedado"),
        })),
      },
      extraction: { runEphemeral },
    });

    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    expect(outcome.reading.executionId).toBe("exec-boa");
    expect(outcome.reading.requirement.consortiumAllowed).toBe(false);
  });

  /**
   * A verificação de "nada extraído" acontece DEPOIS da fusão. É o que faz uma
   * justificativa ilegível — PDF escaneado, que é rotina — ainda virar leitura
   * gravada quando o EDITAL.pdf responde consórcio e CAT.
   */
  it("uma justificativa ilegível ainda vira leitura quando o edital responde", async () => {
    const runEphemeral = vi.fn(async (entrada: { source: { filename: string } }) =>
      entrada.source.filename.includes("Justificativa")
        ? execucao([])
        : execucao([{ field: "Exige atestado registrado no CREA/CAU (CAT)", value: "Sim" }]));
    const { service } = montar({
      files: {
        download: vi.fn(async () => zipDe({
          "Justificativa de Qualificação Técnica.pdf": pdf("scanner"),
          "EDITAL.pdf": pdf("exige CAT"),
        })),
      },
      extraction: { runEphemeral },
    });

    const outcome = await service.read("t-1", auth);

    if (outcome.status !== "READ") throw new Error(outcome.status);
    expect(outcome.reading.requirement.requiresCat).toBe(true);
  });

  /**
   * As três cláusulas de `faltaInstitucional` valem por si. Nos casos em que a
   * primeira leitura só traz parcelas, a do consórcio já basta — e as de CAT e
   * visita poderiam sumir sem teste vermelho.
   */
  it.each([
    ["CAT", [{ field: "Permite consórcio", value: "Permitido" }, { field: "Exige visita técnica", value: "Não" }]],
    ["visita técnica", [{ field: "Permite consórcio", value: "Permitido" }, { field: "Exige atestado registrado no CREA/CAU (CAT)", value: "Sim" }]],
  ])("vai ao edital quando só falta %s", async (_campo, respondidos) => {
    const runEphemeral = vi.fn(async (entrada: { source: { filename: string } }) =>
      entrada.source.filename.includes("Justificativa")
        ? execucao(respondidos as Array<{ field: string; value: string }>)
        : execucao([{ field: "Parcelas de maior relevância e quantitativos mínimos", value: "Drenagem — 450 m" }]));
    const { service } = montar({
      files: {
        download: vi.fn(async () => zipDe({
          "Justificativa de Qualificação Técnica.pdf": pdf("parcial"),
          "EDITAL.pdf": pdf("corpo"),
        })),
      },
      extraction: { runEphemeral },
    });

    await service.read("t-1", auth);

    expect(runEphemeral).toHaveBeenCalledTimes(2);
  });
});

describe("juntar a leitura do anexo com a do edital", () => {
  const vazia = { services: [], limitations: [] };

  /**
   * A base veio do documento mais específico. Um edital que diz "conforme
   * anexo" seria lido como "não informa", e deixá-lo sobrescrever apagaria
   * justamente as parcelas que se foi buscar.
   */
  it("a base manda; o complemento só preenche o que está em branco", () => {
    const juntada = mergeReadings(
      { ...vazia, consortiumAllowed: false },
      { ...vazia, consortiumAllowed: true, requiresCat: true },
      "EDITAL.pdf",
    );

    expect(juntada.consortiumAllowed).toBe(false);
    expect(juntada.requiresCat).toBe(true);
  });

  it("soma as parcelas sem repetir a mesma descrição", () => {
    const juntada = mergeReadings(
      { ...vazia, services: [{ description: "Pavimento em TSD" }] },
      { ...vazia, services: [{ description: "pavimento em tsd" }, { description: "Drenagem pluvial" }] },
      "EDITAL.pdf",
    );

    expect(juntada.services.map((s) => s.description)).toEqual(["Pavimento em TSD", "Drenagem pluvial"]);
  });

  /**
   * Acento e forma Unicode. O anexo costuma vir em NFC e o edital em NFD, e a
   * mesma parcela apareceria duas vezes na tela como se fossem duas exigências.
   */
  it("trata a mesma parcela escrita com acento diferente como uma só", () => {
    const juntada = mergeReadings(
      { ...vazia, services: [{ description: "Pavimentação asfáltica".normalize("NFC") }] },
      { ...vazia, services: [{ description: "PAVIMENTACAO ASFALTICA" }, { description: "Pavimentação".normalize("NFD") }] },
      "EDITAL.pdf",
    );

    expect(juntada.services.map((s) => s.description)).toEqual([
      "Pavimentação asfáltica".normalize("NFC"),
      "Pavimentação".normalize("NFD"),
    ]);
  });

  /** O complemento que só trouxe parcelas também precisa ficar registrado. */
  it("registra a origem quando o complemento contribuiu só com parcelas", () => {
    const juntada = mergeReadings(vazia, { ...vazia, services: [{ description: "Drenagem" }] }, "EDITAL.pdf");

    expect(juntada.limitations).toContain('Complementado com a leitura de "EDITAL.pdf".');
  });

  /**
   * As duas leituras esbarram na mesma limitação com frequência ("não foi
   * possível determinar a visita técnica"), e a tela mostraria a frase duas
   * vezes como se fossem dois problemas diferentes.
   */
  it("não repete a mesma limitação vinda das duas leituras", () => {
    const mesma = "Não foi possível determinar a exigência de visita técnica.";
    const juntada = mergeReadings(
      { ...vazia, limitations: [mesma] },
      { ...vazia, limitations: [mesma, "O edital remete ao anexo."] },
      "EDITAL.pdf",
    );

    expect(juntada.limitations).toEqual([mesma, "O edital remete ao anexo."]);
  });

  it("fica com a menor confiança das duas", () => {
    const juntada = mergeReadings({ ...vazia, confidence: 0.9 }, { ...vazia, confidence: 0.4, requiresCat: true }, "x");
    expect(juntada.confidence).toBe(0.4);
  });

  it("registra de onde veio o complemento, e só quando veio algo", () => {
    const somou = mergeReadings(vazia, { ...vazia, requiresSiteVisit: true }, "EDITAL.pdf");
    const nada = mergeReadings({ ...vazia, requiresCat: true }, vazia, "EDITAL.pdf");

    expect(somou.limitations).toContain('Complementado com a leitura de "EDITAL.pdf".');
    expect(nada.limitations).toEqual([]);
  });
});
