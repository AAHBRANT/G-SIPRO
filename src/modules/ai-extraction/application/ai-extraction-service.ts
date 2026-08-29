import { createHash, randomUUID } from "node:crypto";
import type { AuthorizationContext } from "@/core/authorization/policy";
import { authorize } from "@/core/authorization/policy";
import { readDocumentFile } from "@/core/storage/document-storage";
import { aiExtractionRequestSchema, ephemeralExtractionRequestSchema, AiExtractionProviderError, AiExtractionRuleError, type AiExtractionProvider, type AiExtractionResult, type ExtractionSource } from "../domain/ai-extraction";

export type AiExtractionContext = Readonly<{
  definition: { id:string; promptTemplate:string; promptHash:string; authorizedSources:unknown; modelVersionId:string; approval:boolean; isLatest:boolean };
  model: { id:string; provider:string; providerModelVersion:string; serviceType:string; status:string };
  source: ExtractionSource;
}>;

/** Entrada comum aos dois caminhos, para o miolo não se repetir. */
type Executable = Readonly<{
  idempotencyKey: string;
  definitionId: string;
  requestedFields: string[];
  instructions?: string;
}>;

export interface AiExtractionRepository {
  context(definitionId:string,documentVersionId:string):Promise<AiExtractionContext|undefined>;
  /** Contexto de fonte efêmera: nada é buscado em disco, a procedência vem pronta. */
  ephemeralContext(definitionId:string,source:Extract<ExtractionSource,{kind:"EPHEMERAL"}>):Promise<AiExtractionContext|undefined>;
  begin(request:Executable,inputHash:string,context:AiExtractionContext,actorId:string,correlationId:string):Promise<{id:string;status:string;inputHash:string;reused:boolean}>;
  succeed(id:string,output:AiExtractionResult,providerResponseId:string,context:AiExtractionContext,actorId:string,correlationId:string):Promise<void>;
  fail(id:string,code:string,message:string,actorId:string,correlationId:string):Promise<void>;
  get(id:string):Promise<unknown>;
}

const hash = (value:unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class AiExtractionService {
  constructor(private readonly repository:AiExtractionRepository, private readonly provider:AiExtractionProvider) {}

  /** Extração sobre arquivo preservado no acervo documental. */
  async execute(input:unknown,auth:AuthorizationContext,correlationId:string=randomUUID()) {
    const request=aiExtractionRequestSchema.parse(input),context=await this.repository.context(request.definitionId,request.documentVersionId);
    if(!context)throw new AiExtractionRuleError("Caso de uso ou versão documental não encontrada.");
    // Os bytes vêm do armazenamento, que reconfere o SHA-256 antes de entregar.
    return this.run(request,context,auth,correlationId,() => readDocumentFile(sourceHashOf(context.source)));
  }

  /**
   * Extração sobre fonte efêmera: quem chama já tem os bytes em memória e o
   * arquivo não será preservado.
   *
   * ⚠️ O hash e o tamanho saem dos BYTES, nunca de quem chama. É o que
   * substitui a conferência que o armazenamento fazia — sem isso, "o modelo leu
   * este conteúdo" viraria palavra de quem chamou.
   */
  async executeEphemeral(input:unknown,bytes:Buffer,auth:AuthorizationContext,correlationId:string=randomUUID()) {
    const request=ephemeralExtractionRequestSchema.parse(input);
    if(bytes.byteLength<=0)throw new AiExtractionRuleError("A fonte efêmera chegou vazia.");
    const source={
      kind:"EPHEMERAL" as const,
      uri:request.source.uri,
      filename:request.source.filename,
      documentType:request.source.documentType,
      title:request.source.title,
      fileHash:createHash("sha256").update(bytes).digest("hex"),
      mimeType:request.source.mimeType,
      sizeBytes:bytes.byteLength,
      fetchedAt:new Date(),
    };
    const context=await this.repository.ephemeralContext(request.definitionId,source);
    if(!context)throw new AiExtractionRuleError("Caso de uso não encontrado.");
    return this.run(request,context,auth,correlationId,async () => bytes);
  }

  /** O miolo: os mesmos controles de governança, venha a fonte de onde vier. */
  private async run(request:Executable,context:AiExtractionContext,auth:AuthorizationContext,correlationId:string,bytesOf:()=>Promise<Buffer>) {
    if(!context.definition.approval||!context.definition.isLatest)throw new AiExtractionRuleError("A extração exige a versão mais recente e aprovada do caso de uso.");
    if(context.model.status!=="ACTIVE"||context.model.id!==context.definition.modelVersionId)throw new AiExtractionRuleError("O modelo aprovado não está ativo.");
    if(context.model.provider.trim().toUpperCase()!=="OPENAI"||!context.model.serviceType.toUpperCase().includes("RESPONSES"))throw new AiExtractionRuleError("O BL-502 exige provedor OpenAI com serviço Responses API.");
    const sources=Array.isArray(context.definition.authorizedSources)?context.definition.authorizedSources as Array<{documentType?:unknown;requiredPermission?:unknown}>:[];
    const source=sources.find(item=>item.documentType===context.source.documentType);
    if(!source||typeof source.requiredPermission!=="string")throw new AiExtractionRuleError("O tipo documental não está autorizado neste caso de uso.");
    if(!authorize(auth,{permission:source.requiredPermission}).allowed)throw new AiExtractionRuleError("O usuário não possui a permissão exigida para esta fonte documental.");
    // A procedência entra na chave de idempotência: o mesmo arquivo lido do
    // acervo e da origem externa são leituras diferentes, e têm de continuar
    // distinguíveis no livro-razão.
    const inputHash=hash({definitionId:context.definition.id,promptHash:context.definition.promptHash,modelVersionId:context.model.id,providerModelVersion:context.model.providerModelVersion,sourceKind:context.source.kind,sourceReference:sourceReferenceOf(context.source),fileHash:sourceHashOf(context.source),requestedFields:request.requestedFields,instructions:request.instructions??null});
    const execution=await this.repository.begin(request,inputHash,context,auth.actorId,correlationId);
    if(execution.inputHash!==inputHash)throw new AiExtractionRuleError("A chave de idempotência já foi utilizada para outra entrada.");
    if(execution.reused)return this.repository.get(execution.id);
    try{
      const bytes=await bytesOf();
      const response=await this.provider.execute({model:context.model.providerModelVersion,prompt:context.definition.promptTemplate,documentTitle:context.source.title,documentType:context.source.documentType,fileHash:sourceHashOf(context.source),mimeType:context.source.mimeType,bytes,requestedFields:request.requestedFields,instructions:request.instructions,correlationId});
      await this.repository.succeed(execution.id,response.result,response.providerResponseId,context,auth.actorId,correlationId);
    }catch(error){const code=error instanceof AiExtractionProviderError?error.code:"AI_EXTRACTION_FAILED",message=error instanceof Error?error.message:"Falha não identificada na extração.";await this.repository.fail(execution.id,code.slice(0,120),message.slice(0,500),auth.actorId,correlationId)}
    return this.repository.get(execution.id);
  }
}

const sourceHashOf = (source:ExtractionSource) => source.fileHash;
/** O que aponta a fonte: a versão documental, ou o endereço de onde ela veio. */
const sourceReferenceOf = (source:ExtractionSource) => source.kind==="ARCHIVED"?source.documentVersionId:source.uri;
