import { NextResponse } from "next/server";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { buildSupportExecutionPackage } from "@/modules/support/application/support-execution-package";
import { requireSupportExecutor } from "@/modules/support/infrastructure/support-executor-auth";

const include = {
  reporter: { select: { displayName: true, email: true } },
  attachments: { select: { id: true, fileName: true, fileHash: true, mimeType: true, sizeBytes: true } },
  decisions: { include: { decidedBy: { select: { displayName: true } } }, orderBy: { decidedAt: "desc" as const } },
};

export async function GET(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      requireSupportExecutor(request);
      const tickets = await getDatabase().supportTicket.findMany({
        where: {
          executionLeaseId: null,
          executionAttempts: { lt: 5 },
          OR: [
            { status: "TRIAGED", approvalRequired: false },
            { status: "APPROVED" },
          ],
        },
        include,
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 25,
      });
      return NextResponse.json({
        data: tickets.map((ticket) => ({
          package: buildSupportExecutionPackage(ticket),
          claim: { method: "POST", path: `/api/support/agent/tickets/${ticket.id}`, body: { action: "CLAIM", executorId: "<executor-id>" } },
        })),
        correlationId: context.correlationId,
      });
    } catch (error) {
      return toApiError(error);
    }
  });
}
