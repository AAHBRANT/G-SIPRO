import { randomUUID } from "node:crypto";
import type { NextAuthRequest } from "next-auth";
import { NextResponse } from "next/server";

import { auth } from "@/auth";

export const proxy = auth((request: NextAuthRequest): NextResponse => {
  const correlationId = request.headers.get("x-correlation-id") ?? randomUUID();

  if (["/teams", "/privacy", "/terms"].includes(request.nextUrl.pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  if (request.nextUrl.pathname.startsWith("/api/support/agent/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-correlation-id", correlationId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  if (request.nextUrl.pathname === "/api/notifications/dispatch") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-correlation-id", correlationId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  // Mesma classe de lacuna já vista em /api/support/triage/dispatch (abaixo):
  // rota nova autenticada por token de agendador (Bearer), sem sessão de
  // usuário. Sem esta exceção, o middleware rejeita com 401 antes mesmo de a
  // rota validar o token do Buscador.
  if (request.nextUrl.pathname === "/api/scouting/scan") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-correlation-id", correlationId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  // Rede de segurança da triagem assistida (cron por OIDC do GitHub Actions,
  // sem sessão de usuário). Faltou aqui desde a criação da rota em 2026-08-03:
  // toda execução do workflow recebia 401 deste middleware antes mesmo de a
  // rota chegar a validar o token OIDC — a própria validação nunca executava,
  // por isso o rejeitamento não deixava rastro em nenhum log.
  if (request.nextUrl.pathname === "/api/support/triage/dispatch") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-correlation-id", correlationId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  if (!request.auth?.user) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { error: { code: "AUTHENTICATION_REQUIRED", message: "Autenticação corporativa obrigatória." } },
        { status: 401 },
      );
      response.headers.set("x-correlation-id", correlationId);
      return response;
    }

    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/api/auth/signin";
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.href);
    const response = NextResponse.redirect(signInUrl);
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-correlation-id", correlationId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-correlation-id", correlationId);
  return response;
});

export const config = {
  matcher: ["/((?!api/auth|api/health|api/readiness|_next/static|_next/image|favicon.ico).*)"],
};
