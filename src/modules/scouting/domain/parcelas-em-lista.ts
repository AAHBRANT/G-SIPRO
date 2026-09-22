/**
 * Lê as parcelas de maior relevância quando o edital as escreve em LISTA
 * CORRIDA, e não em tabela.
 *
 * O leitor existente ancora no título da seção e procura uma tabela — formato
 * do edital contra o qual ele foi calibrado. Mas há um segundo formato, tão
 * comum quanto, medido no edital de São Joaquim de Bicas/MG (esgotamento
 * sanitário, 01612516000150-1-000304/2026):
 *
 *   E.3 Para atendimento à QUALIFICAÇÃO TÉCNICO-OPERACIONAL, apresentar para
 *   cada parcela de serviço(s) relevante(s) (...):
 *   EXECUÇÃO DE PAVIMENTO COM APLICAÇÃO DE CONCRETO ASFÁLTICO (...) AF_10/2025 – 1.684,565 M3
 *   ESCORAMENTO DE VALA, TIPO CONTÍNUO COM PERFIL METÁLICO "U" (...) AF_01/2026 - 7.759,63 M2
 *
 * A exigência e o quantitativo estão ali, em texto limpo. Sem reconhecer este
 * formato, a tela cai no fallback "serviços estimados a partir do objeto" e
 * mostra "sem quantitativo no edital" com o número publicado à vista.
 *
 * ⚠️ Só procura DEPOIS da âncora de qualificação técnico-operacional, e numa
 * janela curta. O edital inteiro está cheio de número seguido de unidade —
 * prazo, garantia, percentual — e varrer o documento todo encheria a
 * exigência de acervo de lixo. Achar de menos é recuperável; achar errado
 * manda a equipe disputar obra que não pode.
 */
import type { RequiredService } from "@/modules/scouting/domain/edital-requirement";

/** Onde a lista começa. Aceita as grafias que os editais usam. */
const ANCORAS = [
  /qualifica[çc][ãa]o\s+t[ée]cnico[-\s]*operacional/gi,
  /capacidade\s+t[ée]cnico[-\s]*operacional/gi,
];

/** Quanto texto olhar depois da âncora. A lista vem logo em seguida. */
const JANELA = 2_500;

const UNIDADES = /^(m2|m²|m3|m³|m|km|kg|t|un|und|unid|l|ha|mês|mes)$/i;

const normalizarUnidade = (bruta: string): string => {
  const limpa = bruta.trim().toLowerCase();
  if (limpa === "m2") return "m²";
  if (limpa === "m3") return "m³";
  return limpa;
};

/** Número em formato brasileiro: ponto é milhar, vírgula é decimal. */
const numero = (bruto: string): number | null => {
  const valor = Number(bruto.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
};

const limparDescricao = (bruta: string): string =>
  bruta
    .replace(/_{3,}/g, " ")
    // Código de tabela de referência não é nome de serviço.
    .replace(/\b(AF|COMP|SINAPI|SICRO|SETOP)[_\s]*[\d./]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]+$/, "")
    .slice(0, 300);

export function parcelasEmListaCorrida(texto: string): readonly RequiredService[] {
  const janelas: string[] = [];
  for (const ancora of ANCORAS) {
    ancora.lastIndex = 0;
    let achado: RegExpExecArray | null;
    while ((achado = ancora.exec(texto)) !== null) {
      janelas.push(texto.slice(achado.index, achado.index + JANELA));
      if (janelas.length >= 6) break;
    }
  }
  if (janelas.length === 0) return [];

  const servicos: RequiredService[] = [];
  const vistos = new Set<string>();

  /**
   * ⚠️ Recorte por ÂNCORA DE QUANTITATIVO, não por regex de linha inteira.
   *
   * O texto extraído do PDF não tem quebra de linha: os itens vêm colados, e
   * alguns trazem espaço triplo no meio do nome ("ESCORAMENTO   DE   VALA").
   * Tentar casar "descrição – número unidade" num regex só devolveu, em duas
   * tentativas contra o edital real, o fim da frase anterior e depois um
   * fragmento truncado.
   *
   * Aqui é o inverso, e é determinístico: acha-se cada quantitativo, e a
   * descrição é o texto ENTRE o quantitativo anterior e este.
   *
   * ⚠️ A unidade pode TERMINAR EM DÍGITO ("M2", "M3"). Classe só de letras
   * casa o "M", para no limite de palavra, e a parcela inteira se perde.
   */
  const QUANTITATIVO = /[\u2013\u2014-]\s*([\d.]{1,12}(?:,\d+)?)\s*([A-Za-z\u00c7\u00e7\u00b2\u00b3]{1,3}[23\u00b2\u00b3]?)(?![A-Za-z0-9])/g;

  for (const janela of janelas) {
    QUANTITATIVO.lastIndex = 0;
    let fimAnterior = 0;
    let achado: RegExpExecArray | null;

    while ((achado = QUANTITATIVO.exec(janela)) !== null) {
      const bruta = janela.slice(fimAnterior, achado.index);
      fimAnterior = QUANTITATIVO.lastIndex;

      const unidadeBruta = achado[2] ?? "";
      if (!UNIDADES.test(unidadeBruta)) continue;
      const quantity = numero(achado[1] ?? "");
      if (quantity === null) continue;

      // O texto de abertura ("...o(s) seguinte(s) servico(s) e quantidade(es):")
      // morre no ultimo dois-pontos; o nome do servico vem depois dele.
      const aposDoisPontos = bruta.lastIndexOf(":");
      const description = limparDescricao(
        (aposDoisPontos >= 0 ? bruta.slice(aposDoisPontos + 1) : bruta).slice(-260),
      );
      if (description.length < 12) continue;

      const chave = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      servicos.push({ description, quantity, unit: normalizarUnidade(unidadeBruta) });
      if (servicos.length >= 20) return servicos;
    }
  }

  return servicos;
}
