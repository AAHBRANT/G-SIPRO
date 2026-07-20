INSERT INTO "permissions"("id","code","module","action","description","createdAt","createdBy") VALUES
('b2000000-0000-4000-8000-000000000014','proposals.read','proposals','read','Consultar propostas e seus vínculos de origem',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000'),
('b2000000-0000-4000-8000-000000000015','proposals.create','proposals','create','Criar proposta vinculada à oportunidade e edital/lote aplicável',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000')
ON CONFLICT("code") DO NOTHING;
INSERT INTO "profile_permissions"("profileId","permissionId","grantedAt","grantedBy") SELECT 'a2100000-0000-4000-8000-000000000001',"id",CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000' FROM "permissions" WHERE "code" IN ('proposals.read','proposals.create') ON CONFLICT("profileId","permissionId") DO NOTHING;

