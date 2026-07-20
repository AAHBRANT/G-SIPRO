import { getDatabase } from "../src/core/database/prisma";
import { CompetitionService } from "../src/modules/competitions/application/competition-service";
import { PrismaCompetitionRepository } from "../src/modules/competitions/infrastructure/prisma-competition-repository";

async function main(){
  if(!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/))throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const db=getDatabase(),actorRecord=await db.user.findFirst({where:{status:"ACTIVE"},select:{id:true},orderBy:{createdAt:"asc"}});if(!actorRecord)throw new Error("O smoke exige um usuário ativo.");
  const competition=await db.competition.findFirst({include:{participants:true}}),document=await db.managedDocumentVersion.findFirst();if(!competition?.participants.length||!document)throw new Error("O smoke exige concorrência com participante e versão documental.");
  const service=new CompetitionService(new PrismaCompetitionRepository()),actor=actorRecord.id,source="Smoke controlado BL-402";
  let judgment=await db.competitionAct.findFirst({where:{competitionId:competition.id,type:"JUDGMENT",sourceReference:source},orderBy:{version:"asc"}});
  if(!judgment)judgment=await service.addAct(competition.id,{type:"JUDGMENT",participantId:competition.participants[0].id,summary:"Julgamento sintético controlado",judgmentClassification:"1º lugar",qualification:"Habilitado",criterion:"Critério sintético sem valor oficial",actDate:"2026-07-19",documentVersionId:document.id,sourceReference:source,sourceDate:"2026-07-19"},actor) as typeof judgment;
  if(judgment&&!await db.competitionAct.findFirst({where:{actKey:judgment.actKey,version:2}}))await service.addAct(competition.id,{previousActId:judgment.id,type:"JUDGMENT",participantId:competition.participants[0].id,summary:"Julgamento sintético revisado",judgmentClassification:"1º lugar",qualification:"Habilitado",criterion:"Critério sintético revisado",actDate:"2026-07-19",documentVersionId:document.id,sourceReference:source,sourceDate:"2026-07-19"},actor);
  if(!await db.competitionAct.findFirst({where:{competitionId:competition.id,type:"APPEAL",sourceReference:source}}))await service.addAct(competition.id,{type:"APPEAL",participantId:competition.participants[0].id,summary:"Recurso sintético controlado",actDate:"2026-07-19",deadlineAt:"2026-07-20T18:00:00.000Z",documentVersionId:document.id,sourceReference:source,sourceDate:"2026-07-19"},actor);
  const acts=await db.competitionAct.findMany({where:{competitionId:competition.id,sourceReference:source},orderBy:[{actKey:"asc"},{version:"asc"}]});let appendOnly=false;try{await db.competitionAct.update({where:{id:acts[0].id},data:{summary:"alteração proibida"}})}catch{appendOnly=true}
  const auditEvents=await db.auditEvent.count({where:{entityType:"COMPETITION_ACT",entityId:{in:acts.map(item=>item.id)}}});console.log(JSON.stringify({acts:acts.length,judgmentVersions:acts.filter(item=>item.type==="JUDGMENT").length,appeals:acts.filter(item=>item.type==="APPEAL").length,documentHashMatches:acts.every(item=>item.documentFileHash===document.fileHash),appendOnly,auditEvents}));await db.$disconnect();
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Smoke failed");process.exitCode=1});
