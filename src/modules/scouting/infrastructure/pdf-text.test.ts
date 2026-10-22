import jsPDF from "jspdf";
import { describe, expect, it } from "vitest";

import { extractDocxText, extractPdfText, PdfjsTextExtraction } from "@/modules/scouting/infrastructure/pdf-text";

function pdfComTexto(linhas: readonly string[]): Buffer {
  const documento = new jsPDF();
  linhas.forEach((linha, indice) => documento.text(linha, 10, 10 + indice * 10));
  return Buffer.from(documento.output("arraybuffer"));
}

describe("extractPdfText", () => {
  it("devolve o texto de um PDF de uma página", async () => {
    const bytes = pdfComTexto(["Concorrência 17/2026", "Vedação de empresa em consórcio"]);

    const texto = await extractPdfText(bytes);

    expect(texto).toContain("Concorrência 17/2026");
    expect(texto).toContain("Vedação de empresa em consórcio");
  });

  it("junta várias páginas com quebra de linha entre elas", async () => {
    const documento = new jsPDF();
    documento.text("Primeira página", 10, 10);
    documento.addPage();
    documento.text("Segunda página", 10, 10);
    const bytes = Buffer.from(documento.output("arraybuffer"));

    const texto = await extractPdfText(bytes);
    const paginas = texto.split("\n");

    expect(paginas).toHaveLength(2);
    expect(paginas[0]).toContain("Primeira página");
    expect(paginas[1]).toContain("Segunda página");
  });
});

/**
 * Word entra na leitura sem IA desde 22/10/2026 (termo de referência em .docx
 * é comum). Um .docx mínimo de verdade — o zip com o XML do Word — passa pelo
 * leitor real, e não um dublê.
 */
describe("extractDocxText", () => {
  it("devolve o texto corrido de um .docx", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const docx = Buffer.from(zipSync({
      "[Content_Types].xml": strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
      "_rels/.rels": strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
      "word/document.xml": strToU8('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Parcelas de maior relevância técnica:</w:t></w:r></w:p><w:p><w:r><w:t>Execução de Microdrenagem de no mínimo 103 m.</w:t></w:r></w:p></w:body></w:document>'),
    }));

    const texto = await extractDocxText(docx);
    expect(texto).toContain("Parcelas de maior relevância técnica:");
    expect(texto).toContain("Microdrenagem de no mínimo 103 m.");
  });

  it("o leitor escolhe o formato pelo parâmetro: sem ele, é PDF", async () => {
    await expect(new PdfjsTextExtraction().extract(Buffer.from("não é PDF"))).rejects.toThrow();
  });
});
