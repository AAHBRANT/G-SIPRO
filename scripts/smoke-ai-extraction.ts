import { access } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../src/core/database/prisma";
import { AiGovernanceService } from "../src/modules/ai-governance/application/ai-governance-service";
import { PrismaAiGovernanceRepository } from "../src/modules/ai-governance/infrastructure/prisma-ai-governance-repository";
import { AiExtractionService } from "../src/modules/ai-extraction/application/ai-extraction-service";
import { PrismaAiExtractionRepository } from "../src/modules/ai-extraction/infrastructure/prisma-ai-extraction-repository";
import { AiExtractionProviderError, type AiExtractionProvider } from "../src/modules/ai-extraction/domain/ai-extraction";
import { storeDocumentFile } from "../src/core/storage/document-storage";
import { DocumentService } from "../src/modules/documents/application/document-service";
import { PrismaDocumentRepository } from "../src/modules/documents/infrastructure/prisma-document-repository";

async function main() {
  if (!process.env.DATABASE_URL?.match(/@(?:localhost|127\.0\.0\.1):5433\/gsipro(?:\?|$)/)) throw new Error("Smoke permitido somente no PostgreSQL local G-SIPRO em 5433.");
  const root=process.env.GSIPRO_DOCUMENT_STORAGE_ROOT;
  if(!root)throw new Error("Raiz documental obrigatória no smoke.");
  const db=getDatabase(),users=await db.user.findMany({where:{status:"ACTIVE"},orderBy:{createdAt:"asc"}}),versions=await db.managedDocumentVersion.findMany({include:{document:true},orderBy:{createdAt:"asc"}});
  let source=undefined;
  for(const candidate of versions){try{await access(join(root,candidate.fileHash.slice(0,2),candidate.fileHash.slice(2,4),candidate.fileHash));source=candidate;break}catch{}}
  if(users.length<2)throw new Error("Usuários de smoke indisponíveis.");
  const author=users[0].id,approver=users[1].id;
  if(!source){const stored=await storeDocumentFile(new File(["Documento sintético BL-502. Objeto: validar extração assistida com evidência."],"smoke-bl502.txt",{type:"text/plain"})),documents=new DocumentService(new PrismaDocumentRepository()),logical=await documents.create({type:"SMOKE_AI_SOURCE",title:"Fonte sintética BL-502",classification:"AUDIT",status:"ACTIVE",ownerId:author},author),version=await documents.addVersion(logical.id,{uri:stored.uri,fileHash:stored.fileHash,mimeType:stored.mimeType,sizeBytes:stored.sizeBytes,origin:"Smoke local BL-502 sem conteúdo real"},author);source=await db.managedDocumentVersion.findUnique({where:{id:version.id},include:{document:true}})??undefined}
  if(!source)throw new Error("Arquivo documental de smoke indisponível.");
  const governance=new AiGovernanceService(new PrismaAiGovernanceRepository());
  let model=await db.aiModelVersion.findFirst({where:{provider:"OPENAI",modelName:"SMOKE-BL502"},orderBy:{version:"desc"}});
  if(!model)model=await governance.addModel({provider:"OPENAI",modelName:"SMOKE-BL502",providerModelVersion:"gpt-smoke-bl502",serviceType:"OPENAI_RESPONSES",dataProcessingRegion:"Teste local sem envio externo",retentionRule:"store=false; nenhum dado enviado no smoke",status:"ACTIVE",changeReason:"Smoke BL-502",sourceReference:"Documentação oficial OpenAI Responses API",sourceDate:"2026-07-19"},author) as typeof model;
  if(!model)throw new Error("Modelo de smoke não criado.");
  let useCase=await db.aiUseCaseDefinition.findFirst({where:{code:"SMOKE_BL502_REAL"},include:{approval:true},orderBy:{version:"desc"}});
  if(!useCase){await governance.addUseCase({code:"SMOKE_BL502_REAL",name:"Extração documental sintética",purpose:"Validar execução rastreável sem chamada externa",ownerId:author,inputs:["Versão documental imutável"],outputs:["Campo e evidência"],audience:["Analista autorizado"],riskAssessment:"Resultado sintético, nunca utilizado em decisão",limitations:["Não decide","Exige validação humana"],authorizedSources:[{documentType:source.document.type,requiredPermission:"documents.read"}],evaluationCriteria:["Evidência obrigatória"],modelVersionId:model.id,promptTemplate:"Extraia o campo solicitado e apresente evidência.",effectiveFrom:"2026-07-19",changeReason:"Smoke BL-502"},author);useCase=await db.aiUseCaseDefinition.findFirst({where:{code:"SMOKE_BL502_REAL"},include:{approval:true},orderBy:{version:"desc"}})}
  if(!useCase)throw new Error("Caso de smoke não criado.");
  if(!useCase.approval)await governance.approveUseCase(useCase.id,{note:"Aprovação segregada do smoke BL-502"},approver);
  let calls=0;
  const success:AiExtractionProvider={execute:async()=>{calls++;return{providerResponseId:"resp_smoke_bl502",result:{content:[{field:"campo_smoke",value:"resultado sintético"}],confidence:.91,limitations:["Saída sintética"],evidence:[{excerpt:"Trecho sintético para validação estrutural",locator:"smoke:1"}]}}}};
  const repository=new PrismaAiExtractionRepository(),service=new AiExtractionService(repository,success),auth={actorId:author,permissions:new Set(["ai.execute","documents.read"])},key=`smoke-bl502-success-${randomUUID()}`,request={idempotencyKey:key,definitionId:useCase.id,documentVersionId:source.id,requestedFields:["campo_smoke"]};
  const first=await service.execute(request,auth) as{status:string;evidence:unknown[]},second=await service.execute(request,auth) as{status:string};
  const failureProvider:AiExtractionProvider={execute:async()=>{throw new AiExtractionProviderError("SMOKE_PROVIDER_FAILURE","Falha sintética controlada.")}};
  const failed=await new AiExtractionService(repository,failureProvider).execute({...request,idempotencyKey:`smoke-bl502-failure-${randomUUID()}`},auth) as{status:string;errorCode:string};
  const stored=await db.aiExtractionExecution.findUnique({where:{idempotencyKey:key},include:{evidence:true}}),checks={success:first.status==="SUCCEEDED",evidenceStored:first.evidence.length===1&&stored?.evidence[0]?.documentFileHash===source.fileHash,idempotent:second.status==="SUCCEEDED"&&calls===1,failureObserved:failed.status==="FAILED"&&failed.errorCode==="SMOKE_PROVIDER_FAILURE",audited:(await db.auditEvent.count({where:{entityType:"AI_EXTRACTION_EXECUTION",entityId:stored?.id}}))>=2,permissionInstalled:(await db.permission.count({where:{code:"ai.execute"}}))===1};
  console.log(JSON.stringify(checks));
  if(!Object.values(checks).every(Boolean))throw new Error("Smoke BL-502 falhou.");
  await db.$disconnect();
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Smoke failed");process.exitCode=1});
