import { createHash, randomUUID } from "node:crypto";
import type { AuthorizationContext } from "@/core/authorization/policy";
import { authorize } from "@/core/authorization/policy";
import { readDocumentFile } from "@/core/storage/document-storage";
import { aiExtractionRequestSchema, AiExtractionProviderError, AiExtractionRuleError, type AiExtractionProvider, type AiExtractionRequest, type AiExtractionResult } from "../domain/ai-extraction";

export type AiExtractionContext = Readonly<{
  definition: { id:string; promptTemplate:string; promptHash:string; authorizedSources:unknown; modelVersionId:string; approval:boolean; isLatest:boolean };
  model: { id:string; provider:string; providerModelVersion:string; serviceType:string; status:string };
  documentVersion: { id:string; fileHash:string; mimeType:string; document:{type:string;title:string} };
}>;

export interface AiExtractionRepository {
  context(definitionId:string,documentVersionId:string):Promise<AiExtractionContext|undefined>;
  begin(request:AiExtractionRequest,inputHash:string,context:AiExtractionContext,actorId:string,correlationId:string):Promise<{id:string;status:string;inputHash:string;reused:boolean}>;
  succeed(id:string,output:AiExtractionResult,providerResponseId:string,context:AiExtractionContext,actorId:string,correlationId:string):Promise<void>;
  fail(id:string,code:string,message:string,actorId:string,correlationId:string):Promise<void>;
  get(id:string):Promise<unknown>;
}

const hash = (value:unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class AiExtractionService {
  constructor(private readonly repository:AiExtractionRepository, private readonly provider:AiExtractionProvider) {}

  async execute(input:unknown,auth:AuthorizationContext,correlationId:string=randomUUID()) {
    const request=aiExtractionRequestSchema.parse(input),context=await this.repository.context(request.definitionId,request.documentVersionId);
    if(!context)throw new AiExtractionRuleError("Caso de uso ou versão documental não encontrada.");
    if(!context.definition.approval||!context.definition.isLatest)throw new AiExtractionRuleError("A extração exige a versão mais recente e aprovada do caso de uso.");
    if(context.model.status!=="ACTIVE"||context.model.id!==context.definition.modelVersionId)throw new AiExtractionRuleError("O modelo aprovado não está ativo.");
    if(context.model.provider.trim().toUpperCase()!=="OPENAI"||!context.model.serviceType.toUpperCase().includes("RESPONSES"))throw new AiExtractionRuleError("O BL-502 exige provedor OpenAI com serviço Responses API.");
    const sources=Array.isArray(context.definition.authorizedSources)?context.definition.authorizedSources as Array<{documentType?:unknown;requiredPermission?:unknown}>:[];
    const source=sources.find(item=>item.documentType===context.documentVersion.document.type);
    if(!source||typeof source.requiredPermission!=="string")throw new AiExtractionRuleError("O tipo documental não está autorizado neste caso de uso.");
    if(!authorize(auth,{permission:source.requiredPermission}).allowed)throw new AiExtractionRuleError("O usuário não possui a permissão exigida para esta fonte documental.");
    const inputHash=hash({definitionId:context.definition.id,promptHash:context.definition.promptHash,modelVersionId:context.model.id,providerModelVersion:context.model.providerModelVersion,documentVersionId:context.documentVersion.id,fileHash:context.documentVersion.fileHash,requestedFields:request.requestedFields,instructions:request.instructions??null});
    const execution=await this.repository.begin(request,inputHash,context,auth.actorId,correlationId);
    if(execution.inputHash!==inputHash)throw new AiExtractionRuleError("A chave de idempotência já foi utilizada para outra entrada.");
    if(execution.reused)return this.repository.get(execution.id);
    try{
      const bytes=await readDocumentFile(context.documentVersion.fileHash);
      const response=await this.provider.execute({model:context.model.providerModelVersion,prompt:context.definition.promptTemplate,documentTitle:context.documentVersion.document.title,documentType:context.documentVersion.document.type,fileHash:context.documentVersion.fileHash,mimeType:context.documentVersion.mimeType,bytes,requestedFields:request.requestedFields,instructions:request.instructions,correlationId});
      await this.repository.succeed(execution.id,response.result,response.providerResponseId,context,auth.actorId,correlationId);
    }catch(error){const code=error instanceof AiExtractionProviderError?error.code:"AI_EXTRACTION_FAILED",message=error instanceof Error?error.message:"Falha não identificada na extração.";await this.repository.fail(execution.id,code.slice(0,120),message.slice(0,500),auth.actorId,correlationId)}
    return this.repository.get(execution.id);
  }
}
