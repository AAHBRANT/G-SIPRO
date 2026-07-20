import { getDatabase } from "../src/core/database/prisma";
import { ProposalService } from "../src/modules/proposals/application/proposal-service";
import { PrismaProposalRepository } from "../src/modules/proposals/infrastructure/prisma-proposal-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const db = getDatabase();
  const actor = await db.user.findFirstOrThrow({ where: { status: "ACTIVE" } });
  let proposal = await db.proposal.findUniqueOrThrow({ where: { code: "PROP-TESTE-I3-001" }, include: { versions: { include: { components: true }, orderBy: { version: "asc" } } } });
  if (proposal.versions.length === 1) await new ProposalService(new PrismaProposalRepository()).createVersion(proposal.id, { reason: "Revisão controlada para validar o BL-302." }, actor.id);
  proposal = await db.proposal.findUniqueOrThrow({ where: { id: proposal.id }, include: { versions: { include: { components: true }, orderBy: { version: "asc" } } } });
  const [first, second] = proposal.versions;
  let priorVersionImmutable = false;
  try { await db.$executeRaw`UPDATE "proposal_versions" SET "reason"='Alteração indevida' WHERE "id"=${first.id}::uuid`; } catch { priorVersionImmutable = true; }
  const audits = await db.auditEvent.count({ where: { action: "PROPOSAL_VERSION_CREATED", entityId: proposal.id } });
  const histories = await db.proposalHistory.count({ where: { proposalId: proposal.id, action: "VERSION_CREATED" } });
  const result = { versioning: proposal.version === 2 && proposal.status === "PREPARATION", twoVersions: proposal.versions.length === 2, chainPreserved: second?.previousVersionId === first?.id, componentsComplete: proposal.versions.every(version => version.components.length === 2 && new Set(version.components.map(component => component.type)).size === 2), priorVersionImmutable, histories, audits };
  console.log(JSON.stringify(result));
  if (!Object.values(result).every(value => typeof value === "number" ? value > 0 : value)) throw new Error("Smoke BL-302 não confirmou todas as invariantes.");
  await db.$disconnect();
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
