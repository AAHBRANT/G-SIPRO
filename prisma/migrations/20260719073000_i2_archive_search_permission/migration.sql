INSERT INTO "permissions"("id","code","module","action","description","createdAt","createdBy") VALUES
('b2000000-0000-4000-8000-000000000006','technical-archive.search','technical-archive','search','Pesquisar o acervo por disciplina, serviço, característica, unidade e quantitativo',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000')
ON CONFLICT("code") DO NOTHING;
INSERT INTO "profile_permissions"("profileId","permissionId","grantedAt","grantedBy") SELECT 'a2100000-0000-4000-8000-000000000001',"id",CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000' FROM "permissions" WHERE "code"='technical-archive.search' ON CONFLICT("profileId","permissionId") DO NOTHING;
