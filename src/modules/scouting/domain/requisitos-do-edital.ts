/**
 * Converte a leitura do edital em REQUISITOS da ficha da licitação.
 *
 * Fecha o caminho que a aprovação abriu: a leitura automática já extraía as
 * parcelas de maior relevância e as exigências de participação, mas isso
 * morria na tela da fila. Quem abrisse a licitação para montar proposta
 * relançava tudo à mão.
 *
 * ⚠️ Os requisitos nascem em RASCUNHO, nunca validados. A leitura é
 * assistiva até alguém conferir contra o PDF — parcela lida errado manda a
 * equipe montar consórcio que não precisa, ou disputar sozinha o que não
 * pode. Quem valida é pessoa, pela tela de requisitos.
 *
 * ⚠️ `sourcePage` sai sempre 1, e isso é uma concessão, não um dado: o banco
 * exige página maior que zero (CHECK em `tender_requirements`) e a leitura
 * não captura em que página cada exigência apareceu. Registrar "página 1" é
 * menos ruim que não registrar a exigência, mas ninguém deve tratar esse
 * número como verdade — por isso o texto de cada requisito diz de onde veio.
 */
import type { EditalRequirement } from "@/modules/scouting/domain/edital-requirement";

export type RequisitoDoEdital = Readonly<{
  tenderVersionId: string;
  type: string;
  text: string;
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  responsibleId: string;
  sourceExcerpt: string;
  sourcePage: number;
}>;

/** A leitura não guarda página; o banco exige uma. Ver o aviso no topo. */
const PAGINA_DESCONHECIDA = 1;

const quantitativo = (quantity?: number, unit?: string): string => {
  if (quantity === undefined) return "";
  return ` — ${quantity.toLocaleString("pt-BR")}${unit ? ` ${unit}` : ""}`;
};

export function requisitosDoEdital(
  leitura: EditalRequirement,
  tenderVersionId: string,
  responsibleId: string,
): readonly RequisitoDoEdital[] {
  const base = { tenderVersionId, responsibleId, sourcePage: PAGINA_DESCONHECIDA };
  const requisitos: RequisitoDoEdital[] = [];

  // Parcela de maior relevância é o que inabilita: entra como técnica e alta.
  for (const servico of leitura.services) {
    requisitos.push({
      ...base,
      type: "TECHNICAL",
      text: `Parcela de maior relevância: ${servico.description}${quantitativo(servico.quantity, servico.unit)}`,
      criticality: "HIGH",
      // O trecho é a descrição como o edital a traz, sem reescrita — é o que
      // a pessoa vai procurar no PDF para conferir.
      sourceExcerpt: servico.description,
    });
  }

  if (leitura.consortiumAllowed === false) {
    requisitos.push({
      ...base,
      type: "HABILITATION",
      // Crítico porque muda a decisão de participar, não só o preenchimento:
      // sem consórcio, quem depende de parceiro para o acervo está fora.
      criticality: "CRITICAL",
      text: "Vedada a participação em consórcio.",
      sourceExcerpt: "Leitura automática do edital: consórcio não admitido.",
    });
  } else if (leitura.consortiumAllowed === true) {
    requisitos.push({
      ...base,
      type: "HABILITATION",
      criticality: "LOW",
      text: "Consórcio admitido.",
      sourceExcerpt: "Leitura automática do edital: consórcio admitido.",
    });
  }

  if (leitura.requiresCat) {
    requisitos.push({
      ...base,
      type: "CAT",
      criticality: "HIGH",
      text: "Exige atestado de capacidade técnica registrado no CREA/CAU (CAT).",
      sourceExcerpt: "Leitura automática do edital: exige CAT registrada no conselho.",
    });
  }

  if (leitura.requiresSiteVisit) {
    requisitos.push({
      ...base,
      type: "HABILITATION",
      // Visita costuma ter data marcada e prazo próprio: perder a data
      // inabilita tanto quanto não ter acervo.
      criticality: "HIGH",
      text: "Exige visita técnica.",
      sourceExcerpt: "Leitura automática do edital: visita técnica exigida.",
    });
  }

  if (leitura.requiresProposalBond) {
    requisitos.push({
      ...base,
      type: "FINANCIAL_QUALIFICATION",
      criticality: "HIGH",
      text: "Exige garantia de proposta.",
      sourceExcerpt: "Leitura automática do edital: garantia de proposta exigida.",
    });
  }

  // `limitations` NÃO vira requisito: são o que a leitura declarou não ter
  // conseguido determinar. Virar linha na ficha daria à equipe uma exigência
  // que o edital talvez nem faça.
  return requisitos;
}
