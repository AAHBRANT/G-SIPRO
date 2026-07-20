INSERT INTO "permissions"("id","code","module","action","description","createdAt","createdBy") VALUES
('b2000000-0000-4000-8000-000000000004','technical-professionals.read','technical-professionals','read','Consultar dados profissionais minimizados por finalidade autorizada',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000'),
('b2000000-0000-4000-8000-000000000005','technical-professionals.create','technical-professionals','create','Cadastrar profissional e vínculos técnicos comprovados',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000')
ON CONFLICT("code") DO NOTHING;
INSERT INTO "profile_permissions"("profileId","permissionId","grantedAt","grantedBy") SELECT 'a2100000-0000-4000-8000-000000000001',"id",CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000' FROM "permissions" WHERE "code" IN ('technical-professionals.read','technical-professionals.create') ON CONFLICT("profileId","permissionId") DO NOTHING;
