import type { SupportDiagnosis } from "../domain/support-ticket";

type TicketForExecution = {
  id: string;
  number: number;
  type: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  pagePath: string | null;
  errorMessage: string | null;
  stepsToReproduce: string | null;
  clientContext: unknown;
  aiDiagnosis: unknown;
  approvalRequired: boolean;
  approvalReason: string | null;
  executorId?: string | null;
  executionAttempts?: number;
  resolutionAttempts?: number;
  executionClaimedAt?: Date | null;
  executionHeartbeatAt?: Date | null;
  correlationId: string;
  createdAt: Date;
  reporter: { displayName: string; email: string };
  attachments: Array<{ id: string; fileName: string; fileHash: string; mimeType: string; sizeBytes: bigint }>;
  decisions: Array<{ decision: string; note: string; decidedAt: Date; decidedBy: { displayName: string } }>;
  updates: Array<{ note: string; toStatus: string; actorLabel: string | null; createdAt: Date; createdBy: { displayName: string } | null }>;
};

export function buildSupportExecutionPackage(ticket: TicketForExecution) {
  const diagnosis = ticket.aiDiagnosis as SupportDiagnosis | null;
  return {
    schemaVersion: "1.0",
    ticket: {
      id: ticket.id,
      code: `SUP-${String(ticket.number).padStart(5, "0")}`,
      type: ticket.type,
      priority: ticket.priority,
      status: ticket.status,
      title: ticket.title,
      description: ticket.description,
      pagePath: ticket.pagePath,
      errorMessage: ticket.errorMessage,
      stepsToReproduce: ticket.stepsToReproduce,
      createdAt: ticket.createdAt.toISOString(),
      correlationId: ticket.correlationId,
    },
    requester: { name: ticket.reporter.displayName, email: ticket.reporter.email },
    environment: ticket.clientContext,
    diagnosis,
    authorization: {
      approvalRequired: ticket.approvalRequired,
      approvalReason: ticket.approvalReason,
      decisions: ticket.decisions.map((decision) => ({
        decision: decision.decision,
        note: decision.note,
        decidedAt: decision.decidedAt.toISOString(),
        decidedBy: decision.decidedBy.displayName,
      })),
    },
    execution: {
      executorId: ticket.executorId ?? null,
      attempts: ticket.executionAttempts ?? 0,
      claimedAt: ticket.executionClaimedAt?.toISOString() ?? null,
      heartbeatAt: ticket.executionHeartbeatAt?.toISOString() ?? null,
      deliveredAttempts: ticket.resolutionAttempts ?? 0,
      currentAttempt: Math.min(3, (ticket.resolutionAttempts ?? 0) + 1),
    },
    history: ticket.updates.map((update) => ({
      status: update.toStatus,
      note: update.note,
      actor: update.createdBy?.displayName ?? update.actorLabel ?? "Sistema",
      at: update.createdAt.toISOString(),
    })),
    acceptanceCriteria: diagnosis?.suggestedTests ?? [],
    attachments: ticket.attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      fileHash: attachment.fileHash,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes.toString(),
      contentPath: `/api/support/attachments/${attachment.id}/content`,
    })),
  };
}
