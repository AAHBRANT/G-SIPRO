import { describe, expect, it, vi } from "vitest";
import { browserRandomUuid } from "./browser-random-uuid";

describe("browserRandomUuid", () => {
  it("uses getRandomValues when an embedded browser does not expose randomUUID", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: 16 }, (_, index) => index));
      return bytes;
    });

    expect(browserRandomUuid({ getRandomValues })).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(getRandomValues).toHaveBeenCalledOnce();
  });
});
