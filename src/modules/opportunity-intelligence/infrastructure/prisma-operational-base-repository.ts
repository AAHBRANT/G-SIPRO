import { randomUUID } from "node:crypto";

import { getDatabase } from "@/core/database/prisma";
import type { OperationalBaseRepository } from "../application/operational-base-service";
import type { OperationalBaseDraft } from "../domain/operational-base";

export class PrismaOperationalBaseRepository implements OperationalBaseRepository {
  async create(draft: OperationalBaseDraft, actorId: string, correlationId: string) {
    return getDatabase().$transaction(async transaction => {
      const base = await transaction.operationalBase.create({
        data: {
          id: randomUUID(),
          ...draft,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await transaction.auditEvent.create({
        data: {
          id: randomUUID(),
          actorType: "USER",
          actorId,
          action: "OPERATIONAL_BASE_CREATED",
          entityType: "OPERATIONAL_BASE",
          entityId: base.id,
          correlationId,
          outcome: "SUCCESS",
          origin: "opportunity-intelligence",
          metadata: { code: base.code, locality: base.locality, version: base.version },
        },
      });
      return base;
    });
  }

  listActive() {
    return getDatabase().operationalBase.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }, { code: "asc" }],
    });
  }
}
