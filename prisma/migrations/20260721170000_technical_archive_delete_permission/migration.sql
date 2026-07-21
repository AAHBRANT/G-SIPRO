INSERT INTO "permissions"("id","code","module","action","description","createdAt","createdBy")
VALUES('b2000000-0000-4000-8000-000000000007','technical-archive.delete','technical-archive','delete','Excluir logicamente acervo técnico com motivo e auditoria',CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000')
ON CONFLICT("code") DO NOTHING;

INSERT INTO "profile_permissions"("profileId","permissionId","grantedAt","grantedBy")
SELECT 'a2100000-0000-4000-8000-000000000001',"id",CURRENT_TIMESTAMP,'00000000-0000-0000-0000-000000000000'
FROM "permissions" WHERE "code"='technical-archive.delete'
ON CONFLICT("profileId","permissionId") DO NOTHING;

-- Quem já está autorizado a cadastrar acervo recebe a opção de corrigir cadastros
-- duplicados ou equivocados. Proprietários e mestres também passam pela autorização global.
INSERT INTO "profile_permissions"("profileId","permissionId","grantedAt","grantedBy")
SELECT existing."profileId", deletion."id", CURRENT_TIMESTAMP, '00000000-0000-0000-0000-000000000000'
FROM "profile_permissions" existing
JOIN "permissions" creation ON creation."id"=existing."permissionId" AND creation."code"='technical-archive.create'
CROSS JOIN "permissions" deletion
WHERE deletion."code"='technical-archive.delete'
ON CONFLICT("profileId","permissionId") DO NOTHING;
