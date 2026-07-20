import { createHash, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { AuthorizationError } from "@/core/errors/application-error";

const githubOidcIssuer = "https://token.actions.githubusercontent.com";
const githubOidcAudience = "gsipro-support-agent";
const githubOidcJwks = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const trustedGitHubIdentity = {
  repository: "gutembergp-droid/G-SIPRO",
  repositoryId: "1306983768",
  repositoryOwnerId: "252495539",
  ref: "refs/heads/main",
  workflowRef: "gutembergp-droid/G-SIPRO/.github/workflows/support-codex.yml@refs/heads/main",
} as const;

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isSupportExecutorTokenValid(provided: string, expected: string) {
  if (!provided || !expected) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

export function isGitHubSupportExecutorClaimsValid(payload: JWTPayload) {
  return payload.repository === trustedGitHubIdentity.repository
    && payload.repository_id === trustedGitHubIdentity.repositoryId
    && payload.repository_owner_id === trustedGitHubIdentity.repositoryOwnerId
    && payload.ref === trustedGitHubIdentity.ref
    && payload.workflow_ref === trustedGitHubIdentity.workflowRef
    && payload.repository_visibility === "private"
    && payload.runner_environment === "github-hosted"
    && (payload.event_name === "workflow_dispatch" || payload.event_name === "schedule");
}

async function isGitHubOidcTokenValid(token: string) {
  try {
    const { payload } = await jwtVerify(token, githubOidcJwks, {
      issuer: githubOidcIssuer,
      audience: githubOidcAudience,
    });
    return isGitHubSupportExecutorClaimsValid(payload);
  } catch {
    return false;
  }
}

export async function requireSupportExecutor(request: Request) {
  const expected = process.env.SUPPORT_EXECUTOR_TOKEN?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (expected && isSupportExecutorTokenValid(provided, expected)) {
    return { actorId: "support-automation", actorType: "APPLICATION" as const };
  }
  if (provided && await isGitHubOidcTokenValid(provided)) {
    return { actorId: "github-actions-oidc", actorType: "APPLICATION" as const };
  }
  throw new AuthorizationError("Credencial do executor inválida.", { reason: "SUPPORT_EXECUTOR_CREDENTIAL_INVALID" });
}
