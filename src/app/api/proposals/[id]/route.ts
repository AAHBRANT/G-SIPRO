import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/core/authorization/authorization-context";
import { getDatabase } from "@/core/database/prisma";
import { toApiError } from "@/core/errors/api-error";
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const auth=await requirePermission("proposals.delete"),id=z.uuid().parse((await params).id),body=z.object({reason:z.string().trim().min(5).max(1000)}).parse(await request.json()),db=getDatabase(),current=await db.proposal.findFirst({where:{id,deletedAt:null}});if(!current)return NextResponse.json({error:{message:"Proposta não encontrada."}},{status:404});await db.$transaction(async tx=>{await tx.proposal.update({where:{id},data:{deletedAt:new Date(),deletedBy:auth.actorId,statusReason:body.reason,updatedBy:auth.actorId}});await tx.auditEvent.create({data:{id:randomUUID(),actorType:"USER",actorId:auth.actorId,action:"PROPOSAL_DELETED",entityType:"PROPOSAL",entityId:id,correlationId:randomUUID(),outcome:"SUCCESS",origin:"proposal-panel",metadata:{status:current.status,reason:body.reason,softDelete:true}}})});return NextResponse.json({data:{id,deleted:true}});
 }catch(error){return toApiError(error)}
}
