import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ApplicationError } from "@/core/errors/application-error";
import { getRequestContext } from "@/core/observability/request-context";

export function toApiError(error: unknown): NextResponse {
  const context = getRequestContext();

  if (error instanceof ApplicationError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
          correlationId: context?.correlationId,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Os dados informados são inválidos.",
          fields: error.issues.map((issue) => issue.path.join(".")),
          correlationId: context?.correlationId,
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Não foi possível concluir a operação.",
        correlationId: context?.correlationId,
      },
    },
    { status: 500 },
  );
}
