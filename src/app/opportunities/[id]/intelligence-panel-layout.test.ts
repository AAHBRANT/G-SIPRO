import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./intelligence-panel.tsx", import.meta.url), "utf8");

describe("layout de origem e destino", () => {
  it("mantém campos e textos longos contidos no painel", () => {
    expect(source).toContain('<form className="min-w-0 rounded-xl');
    expect(source).toContain('<label className="grid min-w-0 gap-1 text-xs font-bold text-slate-700">Cidade ou endereço da obra');
    expect(source).toContain('<div className="flex min-w-0 flex-col gap-2">');
    expect(source).toContain('<input className="w-full min-w-0 rounded-lg');
    expect(source).toContain('<option className="whitespace-normal break-words"');
    expect(source).not.toContain('min-w-0 truncate rounded-lg');
  });
});
