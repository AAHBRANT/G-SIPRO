import { describe, expect, it } from "vitest";
import { isGitHubSupportExecutorClaimsValid, isSupportExecutorTokenValid } from "./support-executor-auth";

describe("support executor authentication", () => {
  it("accepts only the configured secret", () => {
    expect(isSupportExecutorTokenValid("a".repeat(40), "a".repeat(40))).toBe(true);
    expect(isSupportExecutorTokenValid("b".repeat(40), "a".repeat(40))).toBe(false);
    expect(isSupportExecutorTokenValid("", "a".repeat(40))).toBe(false);
  });

  it("accepts only the pinned private repository workflow on main", () => {
    const claims = {
      repository: "gutembergp-droid/G-SIPRO",
      repository_id: "1306983768",
      repository_owner_id: "252495539",
      ref: "refs/heads/main",
      workflow_ref: "gutembergp-droid/G-SIPRO/.github/workflows/support-codex.yml@refs/heads/main",
      repository_visibility: "private",
      runner_environment: "github-hosted",
      event_name: "workflow_dispatch",
    };
    expect(isGitHubSupportExecutorClaimsValid(claims)).toBe(true);
    expect(isGitHubSupportExecutorClaimsValid({ ...claims, ref: "refs/heads/feature" })).toBe(false);
    expect(isGitHubSupportExecutorClaimsValid({ ...claims, repository_id: "999" })).toBe(false);
    expect(isGitHubSupportExecutorClaimsValid({ ...claims, workflow_ref: "gutembergp-droid/G-SIPRO/.github/workflows/other.yml@refs/heads/main" })).toBe(false);
  });
});
