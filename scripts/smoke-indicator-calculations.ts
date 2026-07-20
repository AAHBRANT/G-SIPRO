import { getDatabase } from "../src/core/database/prisma";
import { IndicatorService } from "../src/modules/indicators/application/indicator-service";
import { PrismaIndicatorRepository } from "../src/modules/indicators/infrastructure/prisma-indicator-repository";

async function main(){
  if(!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/))throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const db=getDatabase(),users=await db.user.findMany({where:{status:"ACTIVE"},orderBy:{createdAt:"asc"}});if(users.length<2)throw new Error("O smoke exige dois usuários.");
  const author=users[0].id,approver=users[1].id,service=new IndicatorService(new PrismaIndicatorRepository());
  let latest=await db.indicatorDefinition.findFirst({where:{code:"SMOKE_BL404"},orderBy:{version:"desc"}});if(!latest)throw new Error("Execute o smoke BL-404 antes do BL-405.");
  const statuses=((latest.sourceMappings as Array<{validStatuses?:string[]}>)[0]?.validStatuses??[]),validStatuses=["DRAFT","QUALIFICATION","ACTIVE","SUSPENDED","CLOSED"];
  if(latest.calculationMethod!=="PIPELINE_COUNT"||statuses.some(status=>!validStatuses.includes(status))){
    latest=await service.addDefinition({previousDefinitionId:latest.id,code:latest.code,name:"Pipeline sintético BL-405",purpose:"Validar cálculo governado e snapshot imutável",ownerId:author,calculationMethod:"PIPELINE_COUNT",numeratorDefinition:"Quantidade de oportunidades nos estados aprovados",denominatorDefinition:"Não aplicável",treatmentDefinition:"Fotografia do pipeline até o fim do período",granularity:"Oportunidade",sourceMappings:[{logicalTable:"opportunities",field:"status",validStatuses}],dimensions:["tempo"],refreshPeriodicity:"Sob execução autorizada",refreshTime:"Sem SLA presumido",accessRule:"Perfil autorizado",rowSecurityRule:"Escopo permitido",qualityTest:"Conciliar IDs e estados com a origem",qualityTolerance:"Divergência bloqueia publicação",qualityOwnerId:author,effectiveFrom:"2026-07-21",changeReason:"Método executável corrigido e adicionado no BL-405"},author) as typeof latest;
    await service.approveDefinition(latest.id,{note:"Método, fonte e granularidade aprovados para o smoke BL-405"},approver);
  }
  const snapshot=await service.calculateDefinition(latest.id,{periodStart:"2026-01-01",periodEnd:"2026-12-31"},author) as{id:string;payloadHash:string;value:{toFixed:(n:number)=>string}};
  let immutable=false;try{await db.indicatorSnapshot.update({where:{id:snapshot.id},data:{unit:"ALTERADO"}})}catch{immutable=true}
  const stored=await db.indicatorSnapshot.findUnique({where:{id:snapshot.id}}),audit=await db.auditEvent.findFirst({where:{entityType:"INDICATOR_SNAPSHOT",entityId:snapshot.id}}),checks={snapshotStored:Boolean(stored),hashValid:/^[a-f0-9]{64}$/.test(snapshot.payloadHash),methodMatches:stored?.calculationMethod==="PIPELINE_COUNT",immutable,audited:Boolean(audit),valueReproducible:stored?.value.toFixed(8)===snapshot.value.toFixed(8)};
  console.log(JSON.stringify(checks));if(!Object.values(checks).every(Boolean))throw new Error("Smoke do BL-405 não confirmou todas as invariantes.");await db.$disconnect();
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Smoke failed");process.exitCode=1});
