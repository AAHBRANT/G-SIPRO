import { describe, expect, it, vi } from "vitest";

import { localDateTimeToIso } from "./local-date-time";

describe("localDateTimeToIso", () => {
  it("converte o horário local usando o fuso do navegador", () => {
    vi.stubEnv("TZ", "America/Sao_Paulo");
    expect(localDateTimeToIso("2026-07-27T09:00")).toBe("2026-07-27T12:00:00.000Z");
    vi.unstubAllEnvs();
  });

  it("omite valores vazios", () => {
    expect(localDateTimeToIso(null)).toBeUndefined();
    expect(localDateTimeToIso("")).toBeUndefined();
  });
});
