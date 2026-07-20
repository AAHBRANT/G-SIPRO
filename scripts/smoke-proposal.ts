import { randomUUID } from "node:crypto";
import { getDatabase } from "../src/core/database/prisma";
import { OpportunityService } from "../src/modules/opportunities/application/opportunity-service";
import { PrismaOpportunityRepository } from "../src/modules/opportunities/infrastructure/prisma-opportunity-repository";
import { ProposalService } from "../src/modules/proposals/application/proposal-service";
import { PrismaProposalRepository } from "../src/modules/proposals/infrastructure/prisma-proposal-repository";

async function main(){
  if(!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/))throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const db=getDatabase(); const actor=await db.user.findFirstOrThrow({where:{status:"ACTIVE"}});
  const existingOpportunity=await db.opportunity.findUnique({where:{code:"OP-TESTE-I3-001"}});
  const opportunity=existingOpportunity??await new OpportunityService(new PrismaOpportunityRepository()).create({code:"OP-TESTE-I3-001",origin:"PORTAL",subject:"Oportunidade sintética para proposta vinculada a edital e lote."},actor.id);
  let tender=await db.tender.findUnique({where:{code:"ED-TESTE-I3-001"},include:{versions:{orderBy:{version:"desc"}},lots:true}});
  if(!tender){tender=await db.$transaction(async tx=>{const created=await tx.tender.create({data:{id:randomUUID(),code:"ED-TESTE-I3-001",number:"001/I3",modality:"Sintética",subject:"Edital sintético do BL-301",origin:"Fonte sintética controlada BL-301",opportunityId:opportunity!.id,createdBy:actor.id,updatedBy:actor.id}});await tx.tenderLot.create({data:{id:randomUUID(),tenderId:created.id,code:"LOTE-I3-01",subject:"Lote sintético do BL-301",createdBy:actor.id,updatedBy:actor.id}});await tx.tenderVersion.create({data:{id:randomUUID(),tenderId:created.id,version:1,fileName:"edital-sintetico-bl301.pdf",fileHash:"3".repeat(64),source:"Fonte sintética controlada BL-301",receivedAt:new Date(),status:"VALIDATED",createdBy:actor.id}});return tx.tender.findUniqueOrThrow({where:{id:created.id},include:{versions:true,lots:true}})});}
  const version=tender.versions[0],lot=tender.lots[0]; if(!version||!lot)throw new Error("Cenário sintético incompleto.");
  const service=new ProposalService(new PrismaProposalRepository()); let missingTenderBlocked=false; try{await service.create({code:"PROP-TESTE-I3-BLOQUEADA",opportunityId:opportunity.id},actor.id)}catch{missingTenderBlocked=true}
  const existing=await db.proposal.findUnique({where:{code:"PROP-TESTE-I3-001"}}); const proposal=existing??await service.create({code:"PROP-TESTE-I3-001",opportunityId:opportunity.id,tenderVersionId:version.id,tenderLotId:lot.id},actor.id);
  let tamperedOriginBlocked=false; try{await db.$executeRaw`INSERT INTO "proposals"("id","code","opportunityId","opportunityVersion","tenderVersionId","tenderVersionNumber","tenderFileHash","tenderLotId","tenderLotCode","version","status","createdAt","createdBy","updatedAt","updatedBy") VALUES(${randomUUID()}::uuid,'PROP-TESTE-I3-ORIGEM-INVALIDA',${opportunity.id}::uuid,${opportunity.version},${version.id}::uuid,${version.version},${"0".repeat(64)},${lot.id}::uuid,${lot.code},1,'PREPARATION',CURRENT_TIMESTAMP,${actor.id}::uuid,CURRENT_TIMESTAMP,${actor.id}::uuid)`}catch{tamperedOriginBlocked=true}
  let historyAppendOnlyBlocked=false; try{await db.$executeRaw`UPDATE "proposal_history" SET "action"='ALTERACAO_PROIBIDA' WHERE "proposalId"=${proposal.id}::uuid`}catch{historyAppendOnlyBlocked=true}
  const record=await db.proposal.findUniqueOrThrow({where:{id:proposal.id},include:{history:true,tenderVersion:true,tenderLot:true,opportunity:true}}); const audits=await db.auditEvent.count({where:{action:"PROPOSAL_CREATED",entityId:proposal.id}});
  console.log(JSON.stringify({proposal:true,status:record.status,version:record.version,opportunityLinked:record.opportunityId===opportunity.id,opportunityVersionPreserved:record.opportunityVersion===opportunity.version,tenderVersionPreserved:record.tenderVersionId===version.id&&record.tenderVersionNumber===version.version&&record.tenderFileHash===version.fileHash,lotPreserved:record.tenderLotId===lot.id&&record.tenderLotCode===lot.code,missingTenderBlocked,tamperedOriginBlocked,historyAppendOnlyBlocked,history:record.history.length,audits})); await db.$disconnect();
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Smoke failed");process.exitCode=1});
