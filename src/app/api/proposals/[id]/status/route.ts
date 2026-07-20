import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";

const inputSchema=z.object({status:z.enum(["FINALIZED","CANCELLED"]),reason:z.string().trim().min(5).max(1000)});
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const auth=await requirePermission("proposals.manage-status"),id=z.uuid().parse((await params).id),input=inputSchema.parse(await request.json()),db=getDatabase(),current=await db.proposal.findFirst({where:{id,deletedAt:null}});if(!current)return NextResponse.json({error:{message:"Proposta não encontrada."}},{status:404});if(["FINALIZED","CANCELLED"].includes(current.status))return NextResponse.json({error:{message:"A proposta já está encerrada."}},{status:409});
 const updated=await db.$transaction(async tx=>{const item=await tx.proposal.update({where:{id},data:{status:input.status,statusReason:input.reason,statusChangedAt:new Date(),updatedBy:auth.actorId}});await tx.auditEvent.create({data:{id:randomUUID(),actorType:"USER",actorId:auth.actorId,action:`PROPOSAL_${input.status}`,entityType:"PROPOSAL",entityId:id,correlationId:randomUUID(),outcome:"SUCCESS",origin:"proposal-panel",metadata:{previousStatus:current.status,status:input.status,reason:input.reason}}});return item});return NextResponse.json({data:updated});
 }catch(error){return toApiError(error)}
}
