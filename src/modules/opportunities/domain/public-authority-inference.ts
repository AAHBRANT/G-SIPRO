export type InferredPublicAuthority = Readonly<{
  name: string;
  sphere: "MUNICIPAL" | "STATE" | "FEDERAL";
  locality?: string;
}>;

const municipalPatterns = [
  /^prefeitura(?:\s+municipal)?\s+de\s+(.+)$/i,
  /^munic[ií]pio\s+de\s+(.+)$/i,
] as const;

const statePatterns = [
  /^governo\s+do\s+estado\s+de\s+(.+)$/i,
  /^estado\s+de\s+(.+)$/i,
] as const;

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function inferPublicAuthorityFromValueSource(valueSource?: string): InferredPublicAuthority | undefined {
  if (!valueSource?.trim()) return undefined;
  const source = normalized(valueSource);

  for (const pattern of municipalPatterns) {
    const match = pattern.exec(source);
    if (match?.[1]) {
      const locality = normalized(match[1]);
      return {
        name: source.toLowerCase().startsWith("município") || source.toLowerCase().startsWith("municipio")
          ? `Município de ${locality}`
          : `Prefeitura de ${locality}`,
        sphere: "MUNICIPAL",
        locality,
      };
    }
  }

  for (const pattern of statePatterns) {
    const match = pattern.exec(source);
    if (match?.[1]) {
      const locality = normalized(match[1]);
      return { name: `Governo do Estado de ${locality}`, sphere: "STATE", locality };
    }
  }

  if (/^governo\s+federal$/i.test(source) || /^uni[aã]o$/i.test(source)) {
    return { name: "Governo Federal", sphere: "FEDERAL" };
  }

  return undefined;
}
