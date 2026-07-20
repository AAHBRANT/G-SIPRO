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
