import { createHash, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { AuthorizationError } from "@/core/errors/application-error";

const githubOidcIssuer = "https://token.actions.githubusercontent.com";
const githubOidcAudience = "gsipro-support-agent";
const githubOidcJwks = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
// Identidade fixada do repositório autorizado a executar chamados.
// Atualizada em 2026-07-31: o repositório foi transferido de "gutembergp-droid"
// para a organização "AAHBRANT" e estes valores ficaram para trás, fazendo toda
// verificação OIDC falhar — o executor era rejeitado com 403 em cada execução do
// cron e nenhum chamado saía da fila. O repositoryId é preservado pelo GitHub em
// transferências; apenas o nome completo e o owner mudam.
const trustedGitHubIdentity = {
  repository: "AAHBRANT/G-SIPRO",
  repositoryId: "1306983768",
  repositoryOwnerId: "310253480",
  ref: "refs/heads/main",
  workflowRef: "AAHBRANT/G-SIPRO/.github/workflows/support-codex.yml@refs/heads/main",
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
  } catch (error) {
    const oidcError = error as { name?: string; code?: string; claim?: string; reason?: string };
    console.warn(JSON.stringify({
      event: "SUPPORT_GITHUB_OIDC_REJECTED",
      errorName: oidcError.name ?? "UNKNOWN",
      errorCode: oidcError.code ?? "UNKNOWN",
      claim: oidcError.claim ?? null,
      reason: oidcError.reason ?? null,
    }));
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
