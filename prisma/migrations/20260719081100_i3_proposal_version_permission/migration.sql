INSERT INTO "permissions"("id","code","module","action","description","createdAt","createdBy") VALUES
('b2000000-0000-4000-8000-000000000016','proposals.create-version','proposals','create-version','Criar nova versão da proposta sem sobrescrever versões anteriores',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000') ON CONFLICT("code") DO NOTHING;
INSERT INTO "profile_permissions"("profileId","permissionId","grantedAt","grantedBy") SELECT 'a2100000-0000-4000-8000-000000000001',"id",CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000' FROM "permissions" WHERE "code"='proposals.create-version' ON CONFLICT("profileId","permissionId") DO NOTHING;

