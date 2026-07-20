import { PrismaPg } from "@prisma/adapter-pg";

import { getEnvironment } from "@/core/config/env";
import { PrismaClient } from "@/generated/prisma/client";

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };

export function getDatabase(): PrismaClient {
  if (!globalDatabase.prisma) {
    const environment = getEnvironment();
    const adapter = new PrismaPg({ connectionString: environment.DATABASE_URL });
    globalDatabase.prisma = new PrismaClient({ adapter });
  }

  return globalDatabase.prisma;
}
