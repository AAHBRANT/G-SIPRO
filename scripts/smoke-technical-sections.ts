import { randomUUID } from "node:crypto";
import { getDatabase } from "../src/core/database/prisma";
import { TechnicalSectionService } from "../src/modules/proposal-sections/application/technical-section-service";
import { PrismaTechnicalSectionRepository } from "../src/modules/proposal-sections/infrastructure/prisma-technical-section-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const db = getDatabase();
  const actor = await db.user.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const proposal = await db.proposal.findUniqueOrThrow({ where: { code: "PROP-TESTE-I3-001" } });
  if (!proposal.tenderVersionId) throw new Error("Proposta sintética sem versão de edital.");
  let requirement = await db.tenderRequirement.findFirst({ where: { tenderVersionId: proposal.tenderVersionId, text: "Requisito sintético para estrutura técnica BL-303." } });
  requirement ??= await db.tenderRequirement.create({ data: { id: randomUUID(), tenderVersionId: proposal.tenderVersionId, type: "TECHNICAL", text: "Requisito sintético para estrutura técnica BL-303.", criticality: "MEDIUM", responsibleId: actor.id, sourceExcerpt: "A proposta deverá apresentar metodologia executiva.", sourcePage: 1, status: "VALIDATED", version: 1, createdBy: actor.id, updatedBy: actor.id } });
  const currentVersion = await db.proposalVersion.findUniqueOrThrow({ where: { proposalId_version: { proposalId: proposal.id, version: proposal.version } }, include: { components: true } });
  const technical = currentVersion.components.find(component => component.type === "TECHNICAL");
  if (!technical) throw new Error("Componente técnico não encontrado.");
  const service = new TechnicalSectionService(new PrismaTechnicalSectionRepository());
  const existing = await db.proposalTechnicalSection.findFirst({ where: { componentId: technical.id, title: "Metodologia executiva" } });
  const sectionId = existing?.id ?? (await service.create(proposal.id, { type: "Metodologia", title: "Metodologia executiva", position: 1, responsibleId: actor.id, requirementIds: [requirement.id] }, actor.id)).id;
  if ((existing?.version ?? 1) === 1) await service.update(proposal.id, sectionId, { responsibleId: actor.id, status: "IN_PROGRESS", version: 1 }, actor.id);
  const record = await db.proposalTechnicalSection.findUniqueOrThrow({ where: { id: sectionId }, include: { responsible: true, requirements: true, history: true } });
  let snapshotImmutable = false; try { await db.$executeRaw`UPDATE "proposal_technical_section_requirements" SET "sourcePage"=99 WHERE "sectionId"=${sectionId}::uuid`; } catch { snapshotImmutable = true; }
  let historyImmutable = false; try { await db.$executeRaw`UPDATE "proposal_technical_section_history" SET "action"='TAMPERED' WHERE "sectionId"=${sectionId}::uuid`; } catch { historyImmutable = true; }
  const audits = await db.auditEvent.count({ where: { entityType: "PROPOSAL_TECHNICAL_SECTION", entityId: sectionId } });
  const result = { sectionCreated: record.title === "Metodologia executiva", ordered: record.position === 1, responsibleActive: record.responsible.status === "ACTIVE", statusControlled: record.status === "IN_PROGRESS", requirementSnapshot: record.requirements.length === 1 && record.requirements[0]?.requirementVersion === requirement.version, snapshotImmutable, historyImmutable, history: record.history.length, audits };
  console.log(JSON.stringify(result));
  if (!Object.values(result).every(value => typeof value === "number" ? value > 0 : value)) throw new Error("Smoke BL-303 não confirmou todas as invariantes.");
  await db.$disconnect();
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Smoke failed"); process.exitCode = 1; });
