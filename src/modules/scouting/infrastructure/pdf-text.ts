/**
 * Texto puro de um PDF, para o leitor sem IA (`edital-text-requirement.ts`).
 *
 * O build `legacy` existe porque é o único que roda em Node sem DOM: o build
 * padrão do pdfjs-dist assume `Worker`/`document`, que não existem aqui. Sem
 * `GlobalWorkerOptions.workerSrc` configurado, o build legacy cai sozinho para
 * rodar sem worker de verdade — é o comportamento documentado do projeto para
 * ambientes Node, não uma omissão.
 *
 * Cada item de texto vem separado por posição, não por frase: juntar com " "
 * imita quebra de palavra, e cada página termina com "\n" para não colar o
 * fim de uma página no início da outra — o casamento de padrão em
 * `edital-text-requirement.ts` procura pontuação e proximidade, e colar
 * páginas erradas aumentaria falso positivo de fronteira de seção.
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

import type { PdfTextPort } from "@/modules/scouting/application/edital-reading-service";

export async function extractPdfText(bytes: Buffer): Promise<string> {
  const documento = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;

  const paginas: string[] = [];
  for (let numero = 1; numero <= documento.numPages; numero += 1) {
    const pagina = await documento.getPage(numero);
    try {
      const conteudo = await pagina.getTextContent();
      const texto = conteudo.items
        .map((item) => ("str" in item ? (item as TextItem).str : ""))
        .join(" ");
      paginas.push(texto);
    } finally {
      pagina.cleanup();
    }
  }
  return paginas.join("\n");
}

export class PdfjsTextExtraction implements PdfTextPort {
  extract(bytes: Buffer): Promise<string> {
    return extractPdfText(bytes);
  }
}
