export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol" || value === undefined) throw new TypeError("Valor não suportado na exportação canônica.");
  return value;
}

export function canonicalStringify(value: unknown): string {
  return `${JSON.stringify(canonicalize(value))}\n`;
}

