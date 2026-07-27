import { getDatabase } from "@/core/database/prisma";
import type { AttractivenessRepository } from "../application/attractiveness-service";
import type {
  AttractivenessPointInput,
  AttractivenessPointRecord,
} from "../domain/attractiveness-point";

function mapRecord(record: {
  id: string;
  category: string;
  description: string;
  amount: unknown;
  createdAt: Date;
  createdBy: string;
}): AttractivenessPointRecord {
  return {
    id: record.id,
    category: record.category as "QUALITATIVE" | "QUANTITATIVE",
    description: record.description,
    amount: record.amount === null ? null : Number(record.amount),
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
  };
}

export class PrismaAttractivenessRepository implements AttractivenessRepository {
  async create(opportunityId: string, input: AttractivenessPointInput, actorId: string): Promise<AttractivenessPointRecord> {
    const record = await getDatabase().attractivenessPoint.create({
      data: {
        opportunityId,
        category: input.category,
        description: input.description,
        amount: input.amount ?? null,
        createdBy: actorId,
      },
    });
    return mapRecord(record);
  }

  async list(opportunityId: string): Promise<readonly AttractivenessPointRecord[]> {
    const records = await getDatabase().attractivenessPoint.findMany({
      where: { opportunityId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(mapRecord);
  }
}
