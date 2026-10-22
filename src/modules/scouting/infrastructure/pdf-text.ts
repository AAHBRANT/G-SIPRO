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

import type { FormatoDeTexto, PdfTextPort } from "@/modules/scouting/application/edital-reading-service";

/**
 * Teto de páginas por PDF. Desde 22/10/2026 a leitura percorre também os
 * anexos, e um caderno de projeto com centenas de pranchas consumiria o
 * orçamento de tempo da varredura inteira. A exigência técnica de edital,
 * termo de referência e memorial está nas primeiras dezenas de páginas.
 */
export const MAX_PAGINAS_POR_PDF = 150;

export async function extractPdfText(bytes: Buffer): Promise<string> {
  const carregamento = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const documento = await carregamento.promise;

  try {
    const paginas: string[] = [];
    const ultima = Math.min(documento.numPages, MAX_PAGINAS_POR_PDF);
    for (let numero = 1; numero <= ultima; numero += 1) {
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
  } finally {
    // Sem isto o documento inteiro fica preso na memória até o fim da
    // requisição — e com vários anexos por licitação, isso soma.
    await carregamento.destroy();
  }
}

/**
 * Texto de um .docx (termo de referência em Word é comum). Só o texto corrido:
 * tabela vira linhas de texto, que é o que o leitor por padrão já espera.
 */
export async function extractDocxText(bytes: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  return value;
}

export class PdfjsTextExtraction implements PdfTextPort {
  extract(bytes: Buffer, formato: FormatoDeTexto = "pdf"): Promise<string> {
    return formato === "docx" ? extractDocxText(bytes) : extractPdfText(bytes);
  }
}
