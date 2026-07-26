import { describe, expect, it } from "vitest";

import { moduleCatalog } from "@/modules/catalog";

describe("moduleCatalog", () => {
  it("mantém identificadores únicos e dependências válidas", () => {
    const ids = new Set(moduleCatalog.map((entry) => entry.id));
    expect(ids.size).toBe(moduleCatalog.length);
    for (const entry of moduleCatalog) {
      expect(entry.dependencies).not.toContain(entry.id);
      for (const dependency of entry.dependencies) expect(ids.has(dependency)).toBe(true);
    }
  });

  it("mantém auditoria sem dependências funcionais", () => {
    expect(moduleCatalog.find((entry) => entry.id === "audit")?.dependencies).toEqual([]);
  });

  it("registra o modo analítico com as dependências governadas", () => {
    const moduleEntry = moduleCatalog.find((entry) => entry.id === "opportunity-intelligence");
    expect(moduleEntry?.dependencies).toContain("opportunities");
    expect(moduleEntry?.dependencies).toContain("ai");
    expect(moduleEntry?.dependencies).toContain("audit");
  });
});
