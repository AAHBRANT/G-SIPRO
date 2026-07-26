import { describe, expect, it } from "vitest";

import { formatRouteTolls } from "./intelligence-panel";

describe("formatRouteTolls", () => {
  it("soma valores na mesma moeda", () => {
    expect(formatRouteTolls([
      { currencyCode: "BRL", units: "10", nanos: 500_000_000 },
      { currencyCode: "BRL", units: "5", nanos: 0 },
    ])).toBe("R$ 15,50");
  });

  it("não presume custo zero quando a API não informa pedágios", () => {
    expect(formatRouteTolls([])).toBe("Não informado");
  });
});
