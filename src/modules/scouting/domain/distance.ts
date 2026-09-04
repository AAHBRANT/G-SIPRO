/**
 * Distância entre uma licitação e a base operacional mais próxima da empresa.
 *
 * Existe porque a fila hoje só sabe filtrar por UF — um estado inteiro, que no
 * caso de Mato Grosso vai de Pedra Preta a Colniza, quase 1.000 km de
 * diferença dentro do MESMO filtro. "Valor e distância são um critério só":
 * uma obra de R$ 20 mi ao lado da base custa mobilizar muito menos do que uma
 * de R$ 20 mi a 900 km, e a fila não distinguia as duas.
 *
 * ⚠️ O que este módulo NÃO faz: não decide se a distância reprova a
 * licitação, nem quanto o piso de valor deveria subir por km de distância.
 * Essa curva é decisão de negócio — "quanto mais longe, mais caro mobilizar"
 * foi dito, mas nunca com um número. Inventar um coeficiente aqui seria
 * inventar um dado que decide qual licitação a equipe persegue. Este módulo
 * calcula a distância REAL e para aí; a régua que a transforma em corte ou
 * ajuste de piso é de quem conhece o custo de mobilização de verdade.
 *
 * As coordenadas de cada município vêm de `municipios-br.json` — dataset
 * público do IBGE (municípios brasileiros, latitude/longitude do centroide),
 * chave por nome normalizado + UF. É aproximação de centro de município, não
 * do endereço exato da obra — suficiente para a régua de "perto ou longe
 * demais para mobilizar", não para orçar frete.
 */
import municipiosData from "@/modules/scouting/domain/municipios-br.json";
import { normalizeText } from "@/modules/scouting/domain/qualification";

const municipios = municipiosData as unknown as Readonly<Record<string, readonly [number, number]>>;

export type Coordenada = Readonly<{ lat: number; lng: number }>;

/** Uma base operacional da empresa, só o que a distância precisa. */
export type BaseOperacional = Readonly<{ id: string; name: string } & Coordenada>;

/**
 * Coordenada aproximada do centro do município, pelo nome como o PNCP publica
 * e a UF. Devolve `undefined` para município que o IBGE não lista sob esse
 * nome+UF — nome digitado errado no cadastro do órgão, distrito que não é
 * sede de município, ou (mais raro) o próprio dataset desatualizado.
 */
export function coordenadaDoMunicipio(city: string | undefined, state: string | undefined): Coordenada | undefined {
  if (!city || !state) return undefined;
  const chave = `${normalizeText(city)}|${state.trim().toUpperCase()}`;
  const par = municipios[chave];
  return par ? { lat: par[0], lng: par[1] } : undefined;
}

const RAIO_TERRA_KM = 6_371;

/** Distância em linha reta — não é a distância de estrada, mas é de graça e
 *  instantânea, o que importa para triar centenas de licitações por semana. */
export function haversineKm(a: Coordenada, b: Coordenada): number {
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const senos = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(senos));
}

export type NearestBase = Readonly<{ base: BaseOperacional; distanceKm: number }>;

/**
 * A base mais próxima da licitação, e a distância até ela.
 *
 * Devolve `undefined` quando falta coordenada de um lado ou do outro — sem
 * base cadastrada, ou sem o município reconhecido. A ausência é um estado
 * legítimo e tem de aparecer como "não calculado", nunca como zero.
 */
export function nearestBase(
  location: Coordenada | undefined,
  bases: readonly BaseOperacional[],
): NearestBase | undefined {
  if (!location || bases.length === 0) return undefined;
  return bases
    .map((base): NearestBase => ({ base, distanceKm: haversineKm(location, base) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}
