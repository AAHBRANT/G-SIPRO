import type { ArchiveRequirement } from "@/modules/scouting/domain/archive-adherence";
import { normalizeUnit, parseQuantity as parseQuantityText } from "@/modules/scouting/domain/quantity";

/**
 * O que o edital exige de qualificação técnica.
 *
 * Enquanto ninguém lê o edital, o requisito é inferido do objeto — e a tela diz
 * isso em toda linha. Este módulo é o outro lado do encaixe: recebe o que a
 * leitura do edital extraiu e devolve o mesmo `ArchiveRequirement`, agora com
 * `inferred: false`. O confronto com o acervo não muda uma linha.
 *
 * ⚠️ A saída da leitura é assistiva. Uma parcela de maior relevância lida errado
 * manda a equipe montar consórcio que não precisa, ou pior, disputar sozinha o
 * que não pode. Por isso a origem de cada exigência viaja junto (`source`), e
 * `confidence` desce até a tela em vez de ficar no log.
 */

/** Campos pedidos à leitura. O nome é o que o extrator devolve como `field`. */
export const editalFields = [
  "Parcelas de maior relevância e quantitativos mínimos",
  "Exige atestado registrado no CREA/CAU (CAT)",
  "Permite consórcio",
  "Exige visita técnica",
  "Garantia de proposta",
] as const;

export type RequiredService = Readonly<{
  /** Serviço como o edital o descreve, sem reescrita. */
  description: string;
  quantity?: number;
  unit?: string;
}>;

export type EditalRequirement = Readonly<{
  services: readonly RequiredService[];
  consortiumAllowed?: boolean;
  requiresCat?: boolean;
  requiresSiteVisit?: boolean;
  /** 0 a 1, como a leitura declarou. */
  confidence?: number;
  /** O que a leitura não conseguiu determinar. */
  limitations: readonly string[];
}>;

type Field = Readonly<{ field: string; value: string }>;

const acha = (fields: readonly Field[], padrao: RegExp): string | undefined =>
  fields.find((f) => padrao.test(f.field))?.value?.trim();

/**
 * Sim e não em português de edital. "Vedada a participação de consórcio" e
 * "não será permitido consórcio" dizem a mesma coisa de dois jeitos; ler só a
 * palavra "consórcio" daria a resposta trocada.
 */
export function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const texto = value.toLowerCase();
  if (/\b(n[aã]o|vedad|proibid|inadmit|n[aã]o ser[aá] permitid)/.test(texto)) return false;
  if (/\b(sim|permitid|admitid|exigid|obrigat[oó]ri|ser[aá] permitid)/.test(texto)) return true;
  return undefined;
}

/** Número em formato brasileiro: 1.234,56 vira 1234.56. */
export function parseQuantity(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const limpo = value.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const numero = Number(limpo);
  return Number.isFinite(numero) && numero > 0 ? numero : undefined;
}

/**
 * Quantitativo escrito no meio da frase: "Ponte em concreto armado — 15 m".
 *
 * Existe porque a regra que dá sentido a tudo isto — acervo de 30 m cobre
 * exigência de 15 m — depende do número. Perdê-lo quando a leitura devolve
 * prosa em vez de tabela rebaixaria todo confronto a "tem ou não tem a
 * disciplina", que era exatamente a limitação que a leitura veio remover.
 *
 * Vale o PRIMEIRO número cuja unidade é reconhecida, e só ele. Palavra que não
 * é unidade não vira quantitativo: em "2 pontes de 15 m", "pontes" não é
 * unidade, então o 2 é descartado e fica o 15 m. Quantitativo errado é pior do
 * que nenhum — ele decide habilitação parecendo certeza.
 */
function quantityFromProse(text: string): { quantity?: number; unit?: string } {
  for (const match of text.matchAll(/(-?[\d][\d.,]*)\s*([a-zA-ZçÇãÃáÁéÉíÍóÓúÚâÂêÊôÔµ²³]+[23]?)/g)) {
    const lida = parseQuantityText(`${match[1]} ${match[2]}`);
    if (lida) return { quantity: lida.value, unit: lida.unit };
  }
  return {};
}

function parseServices(value: string | undefined): readonly RequiredService[] {
  if (!value) return [];
  let bruto: unknown;
  try {
    bruto = JSON.parse(value);
  } catch {
    // A leitura pode devolver texto corrido quando o edital não traz tabela.
    // Cada linha vira um serviço, com o quantitativo que der para reconhecer.
    return value
      .split(/\r?\n/)
      .map((linha) => linha.replace(/^[\s\-•*\d.)]+/, "").trim())
      .filter((linha) => linha.length > 4)
      .map((description) => ({ description, ...quantityFromProse(description) }));
  }
  if (!Array.isArray(bruto)) return [];

  return bruto.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [{ description: item.trim() }] : [];
    if (typeof item !== "object" || item === null) return [];
    const registro = item as Record<string, unknown>;
    const description = [registro.servico, registro.descricao, registro.parcela, registro.item]
      .find((v): v is string => typeof v === "string" && v.trim().length > 0);
    if (!description) return [];
    const quantity = parseQuantity(registro.quantidade ?? registro.quantitativo);
    const unit = typeof registro.unidade === "string" ? registro.unidade.trim() : undefined;
    return [{
      description: description.trim(),
      ...(quantity !== undefined ? { quantity } : {}),
      ...(unit ? { unit } : {}),
    }];
  });
}

/** Lê o resultado da extração do edital. */
export function parseEditalRequirement(
  fields: readonly Field[],
  extras: Readonly<{ confidence?: number; limitations?: readonly string[] }> = {},
): EditalRequirement {
  return {
    services: parseServices(acha(fields, /parcela|relev[aâ]ncia|quantitativ/i)),
    consortiumAllowed: parseBoolean(acha(fields, /cons[oó]rcio/i)),
    requiresCat: parseBoolean(acha(fields, /crea|cau|\bcat\b/i)),
    requiresSiteVisit: parseBoolean(acha(fields, /visita/i)),
    ...(extras.confidence !== undefined ? { confidence: extras.confidence } : {}),
    limitations: extras.limitations ?? [],
  };
}

/**
 * Converte a exigência lida no requisito que o confronto com o acervo consome.
 *
 * Devolve `null` quando a leitura não achou parcela nenhuma: um requisito vazio
 * daria 100% de cobertura para qualquer empresa, que é o pior resultado
 * possível — pareceria certeza justamente onde não se leu nada.
 */
export function toArchiveRequirement(
  requirement: EditalRequirement,
  estimatedValue?: number,
): ArchiveRequirement | null {
  if (requirement.services.length === 0) return null;
  return {
    // Cada parcela é lida com a mesma régua do acervo. O texto do edital entra
    // como veio: reescrevê-lo aqui perderia o vocabulário do próprio órgão.
    //
    // O quantitativo mínimo viaja junto quando o edital o informa em unidade
    // comparável. É ele que faz "ponte de 30 m cobre exigência de 15 m" deixar
    // de ser leitura de categoria e virar confronto de número.
    sources: requirement.services.map((service) => {
      const unidade = normalizeUnit(service.unit);
      return {
        text: service.description,
        ...(service.quantity !== undefined && unidade
          ? { quantity: { value: service.quantity, unit: unidade } }
          : {}),
      };
    }),
    ...(estimatedValue !== undefined ? { estimatedValue } : {}),
    inferred: false,
  };
}
