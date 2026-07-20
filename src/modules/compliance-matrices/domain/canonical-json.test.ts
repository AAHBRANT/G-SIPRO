import { describe, expect, it } from "vitest";
import { canonicalize, canonicalStringify } from "./canonical-json";

describe("canonicalStringify", () => {
  it("ordena chaves recursivamente", () => { expect(canonicalStringify({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}\n'); });
  it("preserva a ordem dos registros em listas", () => { expect(canonicalStringify([{ b: 2 }, { a: 1 }])).toBe('[{"b":2},{"a":1}]\n'); });
  it("remove campos indefinidos de objetos", () => { expect(canonicalize({ a: 1, b: undefined })).toEqual({ a: 1 }); });
  it("rejeita valores não representáveis em JSON", () => { expect(() => canonicalStringify({ value: 1n })).toThrow(); });
});

