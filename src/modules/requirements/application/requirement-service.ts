import { randomUUID } from "node:crypto";
import { requirementPatchSchema, requirementSchema, requirementValidationSchema, type RequirementDraft } from "@/modules/requirements/domain/requirement";

export type RequirementRecord = Readonly<RequirementDraft & { id: string; status: "DRAFT"|"PENDING_VALIDATION"|"VALIDATED"|"REJECTED"; version: number }>;
export type RequirementRevision = Readonly<{before:RequirementRecord;after:RequirementRecord;changes:Readonly<Record<string,unknown>>;actorId:string;correlationId:string}>;
export interface RequirementRepository { create(draft:RequirementDraft,actorId:string,correlationId:string):Promise<RequirementRecord>; findById(id:string):Promise<RequirementRecord|null>; revise(revision:RequirementRevision):Promise<RequirementRecord>; validate(id:string,justification:string,actorId:string,correlationId:string):Promise<RequirementRecord>; }
export class RequirementNotFoundError extends Error { constructor(id:string){super(`Requisito não encontrado: ${id}`);this.name="RequirementNotFoundError";} }

export class RequirementService {
  constructor(private readonly repository:RequirementRepository){}
  async create(input:unknown,actorId:string,correlationId:string=randomUUID()){return this.repository.create(requirementSchema.parse(input),actorId,correlationId);}
  async update(id:string,input:unknown,actorId:string,correlationId:string=randomUUID()){
    const before=await this.repository.findById(id);if(!before)throw new RequirementNotFoundError(id);
    const patch=requirementPatchSchema.parse(input);const after=Object.freeze({...before,...patch,status:before.status==="VALIDATED"?"PENDING_VALIDATION" as const:before.status,version:before.version+1});
    const changes=Object.fromEntries(Object.keys(patch).map((field)=>[field,{from:before[field as keyof RequirementRecord]??null,to:after[field as keyof RequirementRecord]??null}]));
    if(before.status==="VALIDATED")changes.status={from:"VALIDATED",to:"PENDING_VALIDATION"};
    return this.repository.revise({before,after,changes,actorId,correlationId});
  }
  async validate(id:string,input:unknown,actorId:string,correlationId:string=randomUUID()){
    const requirement=await this.repository.findById(id);if(!requirement)throw new RequirementNotFoundError(id);
    const {justification}=requirementValidationSchema.parse(input);
    return this.repository.validate(id,justification,actorId,correlationId);
  }
}
