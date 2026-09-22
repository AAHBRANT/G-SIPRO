import { describe, expect, it } from "vitest";

import {
  codigoDaLicitacao,
  montarRascunho,
  type ArquivoConferido,
  type DadosDaFila,
} from "@/modules/scouting/domain/licitacao-da-aprovacao";
import { tenderSchema, tenderVersionSchema } from "@/modules/tenders/domain/tender";

const identificador = { authorityDocument: "27142058000126", year: 2026, sequence: 597 };

const arquivo = (titulo: string, extras: Partial<ArquivoConferido> = {}): ArquivoConferido => ({
  titulo,
  documentType: "Outros Documentos",
  fileName: `${titulo}.pdf`,
  fileHash: "a".repeat(64),
  uri: `https://pncp.gov.br/pncp-api/v1/orgaos/27142058000126/compras/2026/597/arquivos/${titulo}`,
  mimeType: "application/pdf",
  sizeBytes: 1_024,
  ...extras,
});

const fila = (extras: Partial<DadosDaFila> = {}): DadosDaFila => ({
  externalId: "27142058000126-1-000597/2026",
  subject: "Execução do sistema de macrodrenagem urbana",
  modality: "Concorrência - Eletrônica",
  processNumber: "27/2026",
  noticeUrl: "https://pncp.gov.br/app/editais/27142058000126/2026/597",
  opportunityId: "11111111-1111-4111-8111-111111111111",
  contractingAuthorityId: "22222222-2222-4222-8222-222222222222",
  ...extras,
});

describe("código da licitação", () => {
  /** Aprovar a mesma licitação duas vezes não pode gerar códigos diferentes. */
  it("é estável e derivado do identificador do portal", () => {
    expect(codigoDaLicitacao(identificador)).toBe("PNCP-27142058000126-000597-2026");
    expect(codigoDaLicitacao(identificador)).toBe(codigoDaLicitacao(identificador));
  });

  it("cabe no limite do campo", () => {
    expect(codigoDaLicitacao(identificador).length).toBeLessThanOrEqual(50);
  });
});

describe("rascunho da licitação", () => {
  /**
   * A régua da IA põe o Termo de Referência na frente, porque é lá que estão
   * os quantitativos. Para a FICHA, quem abre espera ver o edital.
   */
  it("o documento do tipo Edital vira a versão, mesmo vindo depois na lista", () => {
    const rascunho = montarRascunho(
      fila(),
      identificador,
      [
        arquivo("TERMO DE REFERENCIA", { documentType: "Termo de Referência" }),
        arquivo("EDITAL", { documentType: "Edital" }),
        arquivo("PLANILHA"),
      ],
      new Date("2026-09-22T12:00:00.000Z"),
    );

    expect(rascunho.version.fileName).toBe("EDITAL.pdf");
    expect((rascunho.version.attachments as { fileName: string }[]).map((a) => a.fileName))
      .toEqual(["TERMO DE REFERENCIA.pdf", "PLANILHA.pdf"]);
  });

  it("sem documento marcado como edital, usa o primeiro da ordem de relevância", () => {
    const rascunho = montarRascunho(
      fila(),
      identificador,
      [arquivo("TERMO DE REFERENCIA", { documentType: "Termo de Referência" }), arquivo("PLANILHA")],
      new Date(),
    );
    expect(rascunho.version.fileName).toBe("TERMO DE REFERENCIA.pdf");
    expect(rascunho.version.attachments).toHaveLength(1);
  });

  /**
   * O contrato de `TenderService` é quem valida de verdade. Se o rascunho não
   * passar por ele, a licitação nunca nasce — e como isso roda em segundo
   * plano, a falha seria silenciosa.
   */
  it("passa na validação do módulo de licitações", () => {
    const rascunho = montarRascunho(fila(), identificador, [arquivo("EDITAL")], new Date());
    expect(() => tenderSchema.parse(rascunho.tender)).not.toThrow();
    expect(() => tenderVersionSchema.parse(rascunho.version)).not.toThrow();
  });

  it("sem número de processo, usa o identificador do portal em vez de campo vazio", () => {
    const semNumero: DadosDaFila = {
      externalId: "27142058000126-1-000597/2026",
      subject: "Execução do sistema de macrodrenagem urbana",
      modality: "Concorrência - Eletrônica",
      opportunityId: "11111111-1111-4111-8111-111111111111",
    };
    const rascunho = montarRascunho(semNumero, identificador, [arquivo("EDITAL")], new Date());
    expect(rascunho.tender.number).toBe("27142058000126-1-000597/2026");
  });

  it("sem órgão vinculado, a licitação nasce sem o campo em vez de nulo", () => {
    const semOrgao: DadosDaFila = {
      externalId: "27142058000126-1-000597/2026",
      subject: "Execução do sistema de macrodrenagem urbana",
      modality: "Concorrência - Eletrônica",
      processNumber: "27/2026",
      opportunityId: "11111111-1111-4111-8111-111111111111",
    };
    const rascunho = montarRascunho(semOrgao, identificador, [arquivo("EDITAL")], new Date());
    expect("contractingAuthorityId" in rascunho.tender).toBe(false);
    expect(() => tenderSchema.parse(rascunho.tender)).not.toThrow();
  });

  /** Licitação sem arquivo no portal não tem versão para registrar. */
  it("recusa montar quando o órgão não publicou arquivo nenhum", () => {
    expect(() => montarRascunho(fila(), identificador, [], new Date())).toThrow(/Sem arquivo publicado/);
  });

  it("trunca textos longos para caber nos campos", () => {
    const rascunho = montarRascunho(
      fila({ modality: "M".repeat(200), noticeUrl: `https://pncp.gov.br/${"x".repeat(700)}` }),
      identificador,
      [arquivo("E".repeat(600))],
      new Date(),
    );
    expect((rascunho.tender.modality as string).length).toBe(100);
    expect((rascunho.tender.origin as string).length).toBe(500);
    expect((rascunho.version.fileName as string).length).toBe(255);
    expect((rascunho.version.source as string).length).toBe(500);
  });
});
