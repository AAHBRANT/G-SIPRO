ALTER TYPE "ProposalStatus" ADD VALUE IF NOT EXISTS 'FINALIZED';
ALTER TYPE "ProposalStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TABLE "proposals" ADD COLUMN "statusReason" VARCHAR(1000);
ALTER TABLE "proposals" ADD COLUMN "statusChangedAt" TIMESTAMPTZ;
ALTER TABLE "proposals" ADD COLUMN "deletedAt" TIMESTAMPTZ;
ALTER TABLE "proposals" ADD COLUMN "deletedBy" UUID;
CREATE INDEX "proposals_deletedAt_idx" ON "proposals"("deletedAt");
INSERT INTO "permissions"("id","code","module","action","description","createdAt","createdBy") VALUES
('b2000000-0000-4000-8000-000000000030','proposals.manage-status','proposals','manage-status','Finalizar ou cancelar propostas com motivo e auditoria',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000'),
('b2000000-0000-4000-8000-000000000031','proposals.delete','proposals','delete','Excluir logicamente propostas com auditoria',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000')
ON CONFLICT("code") DO NOTHING;
INSERT INTO "profile_permissions"("profileId","permissionId","grantedAt","grantedBy")
SELECT 'a2100000-0000-4000-8000-000000000001',"id",CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000' FROM "permissions"
WHERE "code" IN ('proposals.manage-status','proposals.delete')
ON CONFLICT("profileId","permissionId") DO NOTHING;
