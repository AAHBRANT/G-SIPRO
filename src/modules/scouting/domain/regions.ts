/**
 * Regiões do país, usadas para filtrar a fila de triagem. A licitação guarda a
 * unidade federativa; a região é derivada, para a equipe raciocinar em blocos
 * geográficos sem precisar marcar estado por estado.
 */
export const regions = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"] as const;
export type Region = (typeof regions)[number];

const statesByRegion: Readonly<Record<Region, readonly string[]>> = {
  "Norte": ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
  "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MS", "MT"],
  "Sudeste": ["ES", "MG", "RJ", "SP"],
  "Sul": ["PR", "RS", "SC"],
};

export function statesOf(region: Region): readonly string[] {
  return statesByRegion[region];
}

export function statesOfRegions(selected: readonly string[]): readonly string[] {
  return selected.flatMap((region) => (regions.includes(region as Region) ? statesByRegion[region as Region] : []));
}

export function regionOf(state: string | null | undefined): Region | undefined {
  if (!state) return undefined;
  const upper = state.toUpperCase();
  return regions.find((region) => statesByRegion[region].includes(upper));
}
