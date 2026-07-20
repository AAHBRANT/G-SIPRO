import { getDatabase } from "../src/core/database/prisma";
import { CommercialProposalService } from "../src/modules/commercial-proposals/application/commercial-proposal-service";
import { PrismaCommercialProposalRepository } from "../src/modules/commercial-proposals/infrastructure/prisma-commercial-proposal-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const db = getDatabase();
  const actor = await db.user.findFirstOrThrow({ where: { status: "ACTIVE", email: { not: "aprovador.i3@gsipro.local" } } });
  const proposal = await db.proposal.findUniqueOrThrow({ where: { code: "PROP-TESTE-I3-001" } });
  const version = await db.proposalVersion.findUniqueOrThrow({ where: { proposalId_version: { proposalId: proposal.id, version: proposal.version } }, include: { components: true } });
  const component = version.components.find(item => item.type === "COMMERCIAL");
  if (!component) throw new Error("Componente comercial não encontrado.");
  const service = new CommercialProposalService(new PrismaCommercialProposalRepository());
  let scenario = await db.commercialScenario.findFirst({ where: { componentId: component.id, name: "Cenário sintético final I3" }, orderBy: { version: "desc" } });
  if (!scenario) {
    await service.createScenario({ proposalId: proposal.id, name: "Cenário sintético final I3", currency: "BRL", baseDate: "2026-07-19", estimatedValue: "150000.0000", estimatedSource: "Edital sintético BL-301", assumptions: ["Tributos e custos registrados explicitamente para o smoke"], items: [{ description: "Mobilização e execução", quantity: "1.0000", unit: "vb", unitCost: "80000.0000", unitPrice: "100000.0000" }] }, actor.id);
    scenario = await db.commercialScenario.findFirstOrThrow({ where: { componentId: component.id, name: "Cenário sintético final I3" }, orderBy: { version: "desc" } });
  }
  let rule = await db.commercialAuthorityRule.findFirst({ where: { code: "ALCADA-TESTE-I3" }, orderBy: { version: "desc" } });
  if (!rule) {
    await service.publishAuthority({ code: "ALCADA-TESTE-I3", currency: "BRL", minValue: "0", maxValue: "200000", minDiscountPercent: "0", maxDiscountPercent: "50", minMarginPercent: "10", maxMarginPercent: "50", activeFrom: "2026-07-19T00:00:00-03:00" }, actor.id);
    rule = await db.commercialAuthorityRule.findFirstOrThrow({ where: { code: "ALCADA-TESTE-I3" }, orderBy: { version: "desc" } });
  }
  const approverId = "d3000000-0000-4000-8000-000000000001";
  await db.user.upsert({ where: { id: approverId }, update: { status: "ACTIVE", updatedBy: actor.id }, create: { id: approverId, entraObjectId: "d3000000-0000-4000-8000-000000000002", displayName: "Aprovador Sintético I3", email: "aprovador.i3@gsipro.local", status: "ACTIVE", createdBy: actor.id, updatedBy: actor.id } });
  await db.userProfile.upsert({ where: { userId_profileId: { userId: approverId, profileId: "a2100000-0000-4000-8000-000000000001" } }, update: { validTo: null }, create: { userId: approverId, profileId: "a2100000-0000-4000-8000-000000000001", grantedBy: actor.id, reason: "Perfil sintético controlado para teste de segregação do I3" } });
  let selfApprovalBlocked = false;
  if (!await db.commercialApproval.findFirst({ where: { scenarioId: scenario.id } })) {
    try { await service.approve(scenario.id, { authorityRuleId: rule.id, decision: "APPROVED", justification: "Tentativa de aprovação pelo próprio criador." }, actor.id); } catch { selfApprovalBlocked = true; }
    await service.approve(scenario.id, { authorityRuleId: rule.id, decision: "APPROVED", justification: "Cálculos e premissas conferidos por aprovador segregado." }, approverId);
  } else selfApprovalBlocked = true;
  let submission = await db.proposalSubmission.findUnique({ where: { proposalVersionId: version.id } });
  if (!submission) {
    const evidence = await db.technicalEvidence.findFirstOrThrow({ where: { status: "CURRENT" } });
    await service.submit(proposal.id, { commercialScenarioId: scenario.id, channel: "PORTAL-SINTETICO", submittedAt: "2026-07-19T15:00:00-03:00", protocol: "PROTO-I3-FINAL-001", evidenceDocumentVersionId: evidence.documentVersionId }, actor.id);
    submission = await db.proposalSubmission.findUniqueOrThrow({ where: { proposalVersionId: version.id } });
  }
  const finalProposal = await db.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
  const approval = await db.commercialApproval.findFirstOrThrow({ where: { scenarioId: scenario.id, decision: "APPROVED" } });
  const workflow = await db.proposalWorkflowEvent.findMany({ where: { proposalId: proposal.id }, orderBy: { version: "asc" } });
  let scenarioImmutable=false; try { await db.$executeRaw`UPDATE "commercial_scenarios" SET "offeredPrice"=1 WHERE "id"=${scenario.id}::uuid`; } catch { scenarioImmutable=true; }
  let approvalImmutable=false; try { await db.$executeRaw`UPDATE "commercial_approvals" SET "decision"='REJECTED' WHERE "id"=${approval.id}::uuid`; } catch { approvalImmutable=true; }
  let submissionImmutable=false; try { await db.$executeRaw`UPDATE "proposal_submissions" SET "protocol"='ALTERADO' WHERE "id"=${submission.id}::uuid`; } catch { submissionImmutable=true; }
  const section=await db.proposalTechnicalSection.findFirstOrThrow({where:{component:{proposalVersionId:version.id}}});
  let sentTechnicalMutationBlocked=false; try { await db.proposalTechnicalReviewComment.create({data:{id:"d4000000-0000-4000-8000-000000000001",sectionId:section.id,severity:"NORMAL",comment:"Alteração indevida posterior ao envio.",status:"OPEN",createdBy:actor.id,correlationId:"d4000000-0000-4000-8000-000000000002"}}); } catch { sentTechnicalMutationBlocked=true; }
  const result = { scenarioReproducible: scenario.totalCost.toFixed(2)==="80000.00"&&scenario.offeredPrice.toFixed(2)==="100000.00", formulaCorrect: scenario.discountPercent.toFixed(4)==="33.3333"&&scenario.marginPercent.toFixed(4)==="20.0000", authorityExplicit: approval.authorityRuleId===rule.id, selfApprovalBlocked, segregatedApproval: approval.decidedBy===approverId, workflowComplete: workflow.some(item=>item.toStage==="COMMERCIAL")&&workflow.some(item=>item.toStage==="APPROVAL")&&workflow.some(item=>item.toStage==="SENT"), proposalSent: finalProposal.status==="SENT", payloadFrozen: submission.payloadHash.length===64&&submission.evidenceFileHash.length===64, scenarioImmutable, approvalImmutable, submissionImmutable, sentTechnicalMutationBlocked };
  console.log(JSON.stringify(result));
  if (!Object.values(result).every(Boolean)) throw new Error("Smoke final do I3 não confirmou todas as invariantes.");
  await db.$disconnect();
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Smoke failed");process.exitCode=1});
