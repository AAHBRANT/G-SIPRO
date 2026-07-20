import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "@/core/database/prisma";
import type { ArchiveSearchRepository } from "@/modules/technical-archive/application/archive-search-service";
import type { ArchiveSearchCriteria } from "@/modules/technical-archive/domain/archive-search";

export class PrismaArchiveSearchRepository implements ArchiveSearchRepository {
  async search(criteria: ArchiveSearchCriteria, actorId: string, correlationId: string) {
    const quantityWhere: Prisma.ExecutedQuantityWhereInput = {
      ...(criteria.unit && { unit: { equals: criteria.unit, mode: "insensitive" } }),
      ...((criteria.minQuantity !== undefined || criteria.maxQuantity !== undefined) && {
        value: { ...(criteria.minQuantity !== undefined && { gte: criteria.minQuantity }), ...(criteria.maxQuantity !== undefined && { lte: criteria.maxQuantity }) },
      }),
    };
    const where: Prisma.ExecutedServiceWhereInput = {
      ...(criteria.discipline && { discipline: { contains: criteria.discipline, mode: "insensitive" } }),
      ...(criteria.service && { originalDescription: { contains: criteria.service, mode: "insensitive" } }),
      ...(criteria.characteristic && { characteristics: { contains: criteria.characteristic, mode: "insensitive" } }),
      ...((criteria.unit || criteria.minQuantity !== undefined || criteria.maxQuantity !== undefined) && { quantities: { some: quantityWhere } }),
    };
    const filtersUsed: string[] = [];
    if (criteria.discipline) filtersUsed.push("discipline");
    if (criteria.service) filtersUsed.push("service");
    if (criteria.characteristic) filtersUsed.push("characteristic");
    if (criteria.minQuantity !== undefined || criteria.maxQuantity !== undefined) filtersUsed.push("quantity");
    if (criteria.unit) filtersUsed.push("unit");
    const database = getDatabase();
    const total = await database.executedService.count({ where });
    const records = await database.executedService.findMany({
      where,
      include: {
        quantities: { orderBy: [{ unit: "asc" }, { value: "desc" }] },
        work: true,
        contract: { include: { evidenceDocumentVersion: { include: { document: true } } } },
      },
      orderBy: [{ createdAt: "desc" }, { discipline: "asc" }],
      skip: (criteria.page - 1) * criteria.pageSize,
      take: criteria.pageSize,
    });
    await database.auditEvent.create({
      data: {
        id: randomUUID(), actorType: "USER", actorId, action: "TECHNICAL_ARCHIVE_SEARCHED", entityType: "TECHNICAL_ARCHIVE", entityId: "services", correlationId, outcome: "SUCCESS", origin: "technical-archive-search-service",
        metadata: {
          filtersUsed,
          page: criteria.page, pageSize: criteria.pageSize, results: records.length, total,
          rawTermsStored: false, unitConversionApplied: false,
        },
      },
    });
    return {
      total, page: criteria.page, pageSize: criteria.pageSize,
      items: records.map(record => ({
        serviceId: record.id, discipline: record.discipline, originalDescription: record.originalDescription, characteristics: record.characteristics,
        quantities: record.quantities.map(quantity => ({ value: quantity.value.toString(), unit: quantity.unit, source: quantity.source })),
        work: record.work ? { id: record.work.id, name: record.work.name, type: record.work.type, location: record.work.location } : null,
        contract: { id: record.contract.id, code: record.contract.code, subject: record.contract.subject, contractorName: record.contract.contractorName, status: record.contract.status, startedAt: record.contract.startedAt, endedAt: record.contract.endedAt },
        evidence: { documentTitle: record.contract.evidenceDocumentVersion.document.title, version: record.contract.evidenceDocumentVersion.version, fileHash: record.contract.evidenceDocumentVersion.fileHash },
      })),
    };
  }
}
