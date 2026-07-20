import { NextResponse } from "next/server";
import { requireMaster } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
import { createRequestContext, runWithRequestContext } from "@/core/observability/request-context";
import { buildSupportExecutionPackage } from "@/modules/support/application/support-execution-package";

const include = {
  reporter: { select: { displayName: true, email: true } },
  attachments: { select: { id: true, fileName: true, fileHash: true, mimeType: true, sizeBytes: true } },
  decisions: { include: { decidedBy: { select: { displayName: true } } }, orderBy: { decidedAt: "desc" as const } },
};

export async function GET(request: Request) {
  const context = createRequestContext({ correlationId: request.headers.get("x-correlation-id") ?? undefined });
  return runWithRequestContext(context, async () => {
    try {
      await requireMaster();
      const data = await getDatabase().supportTicket.findMany({
        where: {
          OR: [
            { status: "TRIAGED", approvalRequired: false },
            { status: { in: ["APPROVED", "IN_PROGRESS"] } },
          ],
        },
        include,
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: 100,
      });
      return NextResponse.json({ data: data.map(buildSupportExecutionPackage), correlationId: context.correlationId });
    } catch (error) {
      return toApiError(error);
    }
  });
}
