import { describe,expect,it } from "vitest";
import { competitionActSchema,competitionAwardSchema,competitionResultSchema,competitionSchema,motiveCategorySchema,offerSchema,participantSchema,resultValidationSchema } from "./competition";
const id="00000000-0000-4000-8000-000000000001";
describe("competition domain",()=>{
  it("accepts a competition with explicit source",()=>expect(competitionSchema.parse({tenderId:id,tenderLotId:id,competitionDate:"2026-07-19",sourceReference:"Ata pública",sourceDate:"2026-07-19"}).sourceReference).toBe("Ata pública"));
  it("requires a participant source",()=>expect(()=>participantSchema.parse({legalName:"Empresa A",status:"PARTICIPATING",factStatus:"CONFIRMED",sourceReference:"",sourceDate:"2026-07-19"})).toThrow());
  it("distinguishes estimate from confirmed fact",()=>expect(participantSchema.parse({legalName:"Empresa A",status:"EXPECTED",factStatus:"ESTIMATED",sourceReference:"Pesquisa",sourceDate:"2026-07-19"}).factStatus).toBe("ESTIMATED"));
  it("normalizes currency",()=>expect(offerSchema.parse({amount:"100.0000",currency:"brl",offerDate:"2026-07-19",factStatus:"CONFIRMED",sourceReference:"Ata",sourceDate:"2026-07-19"}).currency).toBe("BRL"));
  it("rejects binary-style excessive precision",()=>expect(()=>offerSchema.parse({amount:"1.00001",currency:"BRL",offerDate:"2026-07-19",factStatus:"CONFIRMED",sourceReference:"Ata",sourceDate:"2026-07-19"})).toThrow());
  it("requires judgment evidence fields",()=>expect(()=>competitionActSchema.parse({type:"JUDGMENT",summary:"Julgamento",actDate:"2026-07-19",documentVersionId:id,sourceReference:"Ata",sourceDate:"2026-07-19"})).toThrow());
  it("requires a deadline for appeals",()=>expect(()=>competitionActSchema.parse({type:"APPEAL",summary:"Recurso administrativo",actDate:"2026-07-19",documentVersionId:id,sourceReference:"Portal",sourceDate:"2026-07-19"})).toThrow());
  it("accepts a fully sourced judgment",()=>expect(competitionActSchema.parse({type:"JUDGMENT",participantId:id,summary:"Julgamento técnico",judgmentClassification:"1º lugar",qualification:"Habilitado",criterion:"Menor preço",actDate:"2026-07-19",documentVersionId:id,sourceReference:"Ata oficial",sourceDate:"2026-07-19"}).type).toBe("JUDGMENT"));
  it("normalizes a governed motive code",()=>expect(motiveCategorySchema.parse({code:"preco",name:"Preço",definition:"Motivo comercial",status:"ACTIVE",changeReason:"Criação aprovada",sourceReference:"Decisão interna",sourceDate:"2026-07-19"}).code).toBe("PRECO"));
  it("requires a result motive and evidence",()=>expect(()=>competitionResultSchema.parse({outcome:"LOSS",justification:"Perda",resultDate:"2026-07-19",sourceReference:"Ata",sourceDate:"2026-07-19"})).toThrow());
  it("accepts a documented contract value",()=>expect(competitionAwardSchema.parse({contractValue:"125000.0000",currency:"brl",documentVersionId:id,sourceReference:"Contrato assinado",sourceDate:"2026-07-19"}).currency).toBe("BRL"));
  it("requires a human validation note",()=>expect(()=>resultValidationSchema.parse({note:""})).toThrow());
});
