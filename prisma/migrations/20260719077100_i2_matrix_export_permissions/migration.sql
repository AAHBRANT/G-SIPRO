INSERT INTO "permissions"("id","code","module","action","description","createdAt","createdBy") VALUES
('b2000000-0000-4000-8000-000000000012','compliance-matrices.finalize','compliance-matrices','finalize','Consolidar matriz com todas as validações técnicas atuais',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000'),
('b2000000-0000-4000-8000-000000000013','compliance-matrices.export','compliance-matrices','export','Baixar exportação rastreável e íntegra da matriz validada',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000')
ON CONFLICT("code") DO NOTHING;
INSERT INTO "profile_permissions"("profileId","permissionId","grantedAt","grantedBy") SELECT 'a2100000-0000-4000-8000-000000000001',"id",CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000' FROM "permissions" WHERE "code" IN ('compliance-matrices.finalize','compliance-matrices.export') ON CONFLICT("profileId","permissionId") DO NOTHING;
