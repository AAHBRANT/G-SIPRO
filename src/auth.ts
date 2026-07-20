import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { getEnvironment } from "@/core/config/env";
import { getDatabase } from "@/core/database/prisma";
import { getEntraConfiguration } from "@/core/identity/entra-config";
import { createLogger } from "@/core/observability/logger";

const entra = getEntraConfiguration();
const environment = getEnvironment();
const authLogger = createLogger(environment);
const entraJwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${entra.tenantId}/discovery/v2.0/keys`));
const teamsResourceUri = environment.AUTH_URL
  ? `api://${new URL(environment.AUTH_URL).host}/${entra.clientId}`
  : undefined;
const teamsAudiences = [entra.clientId, teamsResourceUri].filter((value): value is string => Boolean(value));
const teamsIssuers = [entra.issuer, `https://sts.windows.net/${entra.tenantId}/`];
const embeddedAuthCookies = environment.NODE_ENV === "production" ? {
  sessionToken: { name: "__Secure-authjs.session-token", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true } },
  callbackUrl: { name: "__Secure-authjs.callback-url", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true } },
  csrfToken: { name: "__Host-authjs.csrf-token", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true } },
  pkceCodeVerifier: { name: "__Secure-authjs.pkce.code_verifier", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 15 * 60 } },
  state: { name: "__Secure-authjs.state", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 15 * 60 } },
  nonce: { name: "__Secure-authjs.nonce", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true } },
} : undefined;

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: entra.authSecret,
  trustHost: true,
  useSecureCookies: environment.NODE_ENV === "production",
  cookies: embeddedAuthCookies,
  providers: [
    MicrosoftEntraID({
      clientId: entra.clientId,
      clientSecret: entra.clientSecret,
      issuer: entra.issuer,
      authorization: { params: { prompt: "select_account", scope: "openid profile email User.Read" } },
    }),
    Credentials({
      id: "teams-sso",
      name: "Microsoft Teams",
      credentials: { teamsToken: { label: "Teams token", type: "text" } },
      async authorize(credentials) {
        authLogger.info({ stage: "TEAMS_AUTHORIZE_STARTED" }, "Autenticação SSO do Teams iniciada.");
        const teamsToken = typeof credentials?.teamsToken === "string" ? credentials.teamsToken : undefined;
        if (!teamsToken) {
          authLogger.warn({ reason: "TOKEN_MISSING" }, "Token SSO do Teams recusado.");
          return null;
        }
        try {
          const { payload } = await jwtVerify(teamsToken, entraJwks, { issuer: teamsIssuers, audience: teamsAudiences });
          const entraObjectId = typeof payload.oid === "string" ? payload.oid : undefined;
          const tenantId = typeof payload.tid === "string" ? payload.tid : undefined;
          const emailClaim = [payload.preferred_username, payload.email, payload.upn]
            .find((value): value is string => typeof value === "string")
            ?.trim()
            .toLowerCase();
          if (!entraObjectId) {
            authLogger.warn({ reason: "OID_MISSING", tokenVersion: payload.ver }, "Token SSO do Teams recusado.");
            return null;
          }
          if (tenantId !== entra.tenantId) {
            authLogger.warn({ reason: "TENANT_MISMATCH", tokenVersion: payload.ver }, "Token SSO do Teams recusado.");
            return null;
          }
          const database = getDatabase();
          const user = await database.user.findUnique({ where: { entraObjectId } })
            ?? (emailClaim ? await database.user.findUnique({ where: { email: emailClaim } }) : null);
          if (!user) {
            authLogger.warn({ reason: "USER_NOT_PROVISIONED", emailClaimPresent: Boolean(emailClaim), tokenVersion: payload.ver }, "Token SSO do Teams recusado.");
            return null;
          }
          if (user.status !== "ACTIVE") {
            authLogger.warn({ reason: "USER_NOT_ACTIVE", userStatus: user.status }, "Token SSO do Teams recusado.");
            return null;
          }
          if (user.entraObjectId !== entraObjectId) await database.user.update({ where: { id: user.id }, data: { entraObjectId, updatedBy: user.id } });
          return { id: user.id, name: user.displayName, email: user.email, entraObjectId, tenantId };
        } catch (error) {
          authLogger.warn({ reason: "TOKEN_VALIDATION_FAILED", errorType: error instanceof Error ? error.name : "UNKNOWN" }, "Token SSO do Teams recusado.");
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  logger: {
    error(error) {
      const cause = error.cause as { err?: { name?: string; message?: string } } | undefined;
      authLogger.error({
        errorType: error.name,
        authErrorType: "type" in error ? error.type : undefined,
        authErrorMessage: error.message,
        causeErrorType: cause?.err?.name,
        causeErrorMessage: cause?.err?.message,
      }, "Falha na autenticação corporativa.");
    },
    warn(code) {
      authLogger.warn({ authWarning: code }, "Alerta na autenticação corporativa.");
    },
    debug(code) {
      authLogger.debug({ authEvent: code }, "Evento da autenticação corporativa.");
    },
  },
  callbacks: {
    async signIn({ profile, account }) {
      if (account?.provider === "teams-sso") return true;
      if (profile?.tid !== entra.tenantId || typeof profile.oid !== "string" || typeof profile.email !== "string") {
        return false;
      }

      const database = getDatabase();
      const email = profile.email.toLowerCase();
      const displayName = typeof profile.name === "string" ? profile.name : profile.email;
      const authenticated = await database.user.findUnique({ where: { entraObjectId: profile.oid } });
      const provisioned = authenticated ?? await database.user.findUnique({ where: { email } });
      if (provisioned) {
        await database.user.update({ where: { id: provisioned.id }, data: { entraObjectId: profile.oid, displayName, email } });
      } else {
        const id = randomUUID();
        await database.user.create({ data: { id, entraObjectId: profile.oid, displayName, email, createdBy: id, updatedBy: id } });
      }
      return true;
    },
    async jwt({ token, profile, user }) {
      if (typeof profile?.oid === "string") token.entraObjectId = profile.oid;
      if (typeof profile?.tid === "string") token.tenantId = profile.tid;
      if (typeof user?.entraObjectId === "string") token.entraObjectId = user.entraObjectId;
      if (typeof user?.tenantId === "string") token.tenantId = user.tenantId;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.entraObjectId = typeof token.entraObjectId === "string" ? token.entraObjectId : undefined;
        session.user.tenantId = typeof token.tenantId === "string" ? token.tenantId : undefined;
      }
      return session;
    },
  },
});
