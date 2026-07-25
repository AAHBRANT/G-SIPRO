import { parseProposalAnalysisFields } from "@/app/proposals/proposal-analysis-summary";

export type AnalysisContextDefaults = Readonly<{
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  workStart?: string;
  workEnd?: string;
  sources: readonly string[];
}>;

type SourceDocument = Readonly<{
  title: string;
  analysis: null | { output: unknown };
}>;

const locationPattern = /^(?:local(?:iza[cç][aã]o)?(?: da obra)?|munic[ií]pio|cidade|endere[cç]o(?: da obra)?)$/i;
const latitudePattern = /^latitude(?: da obra)?$/i;
const longitudePattern = /^longitude(?: da obra)?$/i;
const workStartPattern = /^(?:in[ií]cio|data de in[ií]cio).*(?:obra|execu[cç][aã]o)$/i;
const workEndPattern = /^(?:fim|t[eé]rmino|data (?:de )?(?:fim|t[eé]rmino)).*(?:obra|execu[cç][aã]o)$/i;

function parseCoordinate(value: string, minimum: number, maximum: number) {
  const match = value.trim().replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const coordinate = Number(match[0]);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : undefined;
}

function parseDate(value: string) {
  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const brazilian = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (!brazilian) return undefined;
  return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`;
}

export function collectAnalysisContextDefaults(documents: readonly SourceDocument[]): AnalysisContextDefaults {
  let locationLabel: string | undefined;
  let latitude: number | undefined;
  let longitude: number | undefined;
  let workStart: string | undefined;
  let workEnd: string | undefined;
  const sources = new Set<string>();

  for (const document of documents) {
    for (const field of parseProposalAnalysisFields(document.analysis?.output)) {
      const label = field.field.trim();
      const value = field.value.trim();
      let used = false;
      if (!locationLabel && locationPattern.test(label)) {
        locationLabel = value;
        used = true;
      } else if (latitude === undefined && latitudePattern.test(label)) {
        latitude = parseCoordinate(value, -90, 90);
        used = latitude !== undefined;
      } else if (longitude === undefined && longitudePattern.test(label)) {
        longitude = parseCoordinate(value, -180, 180);
        used = longitude !== undefined;
      } else if (!workStart && workStartPattern.test(label)) {
        workStart = parseDate(value);
        used = Boolean(workStart);
      } else if (!workEnd && workEndPattern.test(label)) {
        workEnd = parseDate(value);
        used = Boolean(workEnd);
      }
      if (used) sources.add(document.title);
    }
  }

  return {
    ...(locationLabel && { locationLabel }),
    ...(latitude !== undefined && { latitude }),
    ...(longitude !== undefined && { longitude }),
    ...(workStart && { workStart }),
    ...(workEnd && { workEnd }),
    sources: [...sources],
  };
}
