INSERT INTO "permissions"("id","code","module","action","description","createdAt","createdBy") VALUES
('b2000000-0000-4000-8000-000000000011','compliance-matrices.validate-item','compliance-matrices','validate-item','Registrar validação técnica humana, lacuna, risco e tratamento por item',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000')
ON CONFLICT("code") DO NOTHING;
INSERT INTO "profile_permissions"("profileId","permissionId","grantedAt","grantedBy") SELECT 'a2100000-0000-4000-8000-000000000001',"id",CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000' FROM "permissions" WHERE "code"='compliance-matrices.validate-item' ON CONFLICT("profileId","permissionId") DO NOTHING;

