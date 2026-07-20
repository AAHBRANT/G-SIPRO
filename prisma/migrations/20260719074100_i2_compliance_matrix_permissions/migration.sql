INSERT INTO "permissions"("id","code","module","action","description","createdAt","createdBy") VALUES
('b2000000-0000-4000-8000-000000000007','requirements.validate','requirements','validate','Validar requisito após decisões humanas por competência',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000'),
('b2000000-0000-4000-8000-000000000008','compliance-matrices.read','compliance-matrices','read','Consultar matrizes e itens rastreáveis',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000'),
('b2000000-0000-4000-8000-000000000009','compliance-matrices.create','compliance-matrices','create','Criar matriz a partir de requisitos validados',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000')
ON CONFLICT("code") DO NOTHING;
INSERT INTO "profile_permissions"("profileId","permissionId","grantedAt","grantedBy") SELECT 'a2100000-0000-4000-8000-000000000001',"id",CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000' FROM "permissions" WHERE "code" IN ('requirements.validate','compliance-matrices.read','compliance-matrices.create') ON CONFLICT("profileId","permissionId") DO NOTHING;

