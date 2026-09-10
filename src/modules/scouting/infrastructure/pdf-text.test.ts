import jsPDF from "jspdf";
import { describe, expect, it } from "vitest";

import { extractPdfText } from "@/modules/scouting/infrastructure/pdf-text";

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
