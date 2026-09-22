/**
 * Completa a EXIGÊNCIA DE ACERVO quando ela sai incompleta da primeira leitura.
 *
 * O problema que isto resolve, relatado em 22/09/2026: "ele só está lendo o
 * edital e não acha os valores para comparar com nosso acervo, aí dá tudo
 * 'sem valor no edital'". O sistema lê um documento só, e a tabela de parcelas
 * de maior relevância — ou o quantitativo mínimo de cada uma — costuma estar
 * em OUTRO anexo do mesmo pacote.
 *
 * ⚠️ O alvo é só o acervo técnico exigido: as poucas parcelas que o edital
 * manda comprovar com atestado, e o mínimo de cada uma. Não é a planilha
 * orçamentária, nem a lista de serviços da obra, nem insumo. Isso foi tentado
 * e recusado pelo dono — trazer o orçamento inteiro encheria a comparação de
 * dezenas de itens que ninguém exige atestado, e afogaria as três que decidem
 * habilitação.
 *
 * ⚠️ A base sempre manda. O anexo só preenche o que ficou em branco, nunca
 * sobrescreve: a leitura principal veio do documento mais específico, e trocar
 * um quantitativo já lido pelo de outro arquivo é como perder a parcela certa.
 */
import type { EditalRequirement, RequiredService } from "@/modules/scouting/domain/edital-requirement";

/** Mesma régua de comparação usada na fusão de leituras. */
const chave = (descricao: string): string =>
  descricao.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Tira o quantitativo mínimo de DENTRO da descrição da parcela.
 *
 * Medido em editais reais do PNCP: o quantitativo não vem em campo próprio,
 * vem na mesma frase da parcela — "Sistema de Bombeamento (...) vazão mínima
 * 7,5 m³/s", "execução de pavimentação em no mínimo 30.000 m²". A leitura
 * devolve a parcela com a frase inteira na descrição e o campo de quantidade
 * vazio, e a tela conclui "sem quantitativo no edital" com o número à vista.
 *
 * ⚠️ Só extrai com ÂNCORA DE MÍNIMO por perto ("mínimo", "mínima", "no mínimo
 * de"). Pegar qualquer número da frase encontraria o número do item, o da
 * norma técnica e o do lote — e um quantitativo errado aqui vira "atende" na
 * tela, que é o erro que manda disputar obra sem poder.
 */
const ANCORA_MINIMO = /m[íi]nim[oa]s?\s*(?:de\s*)?[:\s]*([\d.]{1,12}(?:,\d+)?)\s*([a-zA-ZçÇ²³µ]+[23]?)/;

export function quantitativoNaDescricao(descricao: string): Readonly<{ quantity: number; unit: string }> | null {
  const achado = ANCORA_MINIMO.exec(descricao);
  if (!achado?.[1] || !achado[2]) return null;

  const bruto = achado[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const quantity = Number(bruto);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const unit = achado[2].trim();
  // Unidade precisa parecer unidade: uma palavra curta. "mínimo 3 vezes" não
  // é quantitativo de acervo.
  if (unit.length > 4) return null;
  return { quantity, unit };
}

/**
 * Completa, em cada parcela sem quantidade, o número que está escrito na
 * própria descrição. Nada além disso: parcela que não traz número na frase
 * continua sem quantitativo, que é o estado honesto.
 */
export function extrairQuantitativosDaDescricao(requirement: EditalRequirement): EditalRequirement {
  let mudou = false;
  const services = requirement.services.map((servico): RequiredService => {
    if (servico.quantity !== undefined) return servico;
    const achado = quantitativoNaDescricao(servico.description);
    if (!achado) return servico;
    mudou = true;
    return { description: servico.description, quantity: achado.quantity, unit: achado.unit };
  });
  return mudou ? { ...requirement, services } : requirement;
}

/**
 * Falta acervo quando não há parcela nenhuma, ou quando NENHUMA das parcelas
 * lidas trouxe quantitativo.
 *
 * Uma parcela sem quantitativo ainda serve para saber se a empresa tem o
 * serviço; o que ela não permite é comparar o quanto. É exatamente o estado
 * que a tela mostra como "sem quantitativo no edital".
 */
export function faltaAcervo(requirement: EditalRequirement): boolean {
  if (requirement.services.length === 0) return true;
  return requirement.services.every((servico) => servico.quantity === undefined);
}

/** Quantas parcelas já têm quantitativo — serve para decidir se vale insistir. */
export function parcelasComQuantitativo(requirement: EditalRequirement): number {
  return requirement.services.filter((servico) => servico.quantity !== undefined).length;
}

/**
 * Enriquece as parcelas da base com o que o anexo trouxe, e acrescenta as que
 * a base não tinha.
 *
 * A diferença para a fusão comum: aqui uma parcela que JÁ EXISTE na base pode
 * ser completada. A fusão comum descarta o serviço repetido, e com isso perde
 * justamente o quantitativo que se foi buscar no anexo — a parcela já estava
 * lá, só que vazia.
 */
export function completarAcervo(base: EditalRequirement, anexo: EditalRequirement): EditalRequirement {
  const doAnexo = new Map<string, RequiredService>();
  for (const servico of anexo.services) {
    const k = chave(servico.description);
    if (k && !doAnexo.has(k)) doAnexo.set(k, servico);
  }

  const jaVistos = new Set<string>();
  const completadas = base.services.map((servico): RequiredService => {
    const k = chave(servico.description);
    jaVistos.add(k);
    const encontrado = doAnexo.get(k);
    if (!encontrado) return servico;
    // Só preenche o que falta. Quantitativo já lido não é substituído.
    return {
      description: servico.description,
      ...(servico.quantity !== undefined
        ? { quantity: servico.quantity, ...(servico.unit ? { unit: servico.unit } : {}) }
        : encontrado.quantity !== undefined
          ? { quantity: encontrado.quantity, ...(encontrado.unit ? { unit: encontrado.unit } : {}) }
          : {}),
    };
  });

  const novas = anexo.services.filter((servico) => {
    const k = chave(servico.description);
    if (!k || jaVistos.has(k)) return false;
    jaVistos.add(k);
    return true;
  });

  return { ...base, services: [...completadas, ...novas] };
}
