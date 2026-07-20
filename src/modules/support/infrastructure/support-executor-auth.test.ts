import { describe, expect, it } from "vitest";
import { isSupportExecutorTokenValid } from "./support-executor-auth";

describe("support executor authentication", () => {
  it("accepts only the configured secret", () => {
    expect(isSupportExecutorTokenValid("a".repeat(40), "a".repeat(40))).toBe(true);
    expect(isSupportExecutorTokenValid("b".repeat(40), "a".repeat(40))).toBe(false);
    expect(isSupportExecutorTokenValid("", "a".repeat(40))).toBe(false);
  });
});
