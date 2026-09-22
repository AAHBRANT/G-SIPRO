/**
 * A esfera administrativa como o PNCP a entrega: uma letra só.
 *
 * Vivia apenas na tela da fila. Passou para o domínio quando a aprovação
 * começou a cadastrar o órgão sozinho — o registro do órgão guarda a esfera
 * por extenso, e duas tabelas de tradução divergentes dariam "M" no cadastro
 * e "Municipal" na tela para a mesma licitação.
 */
export const rotulosDeEsfera: Record<string, string> = { F: "Federal", E: "Estadual", M: "Municipal", D: "Distrital" };

export function rotuloDaEsfera(sigla: string | undefined): string | undefined {
  return sigla ? rotulosDeEsfera[sigla.trim().toUpperCase()] : undefined;
}
