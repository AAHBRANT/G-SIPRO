-- O cadastro de atestados, CATs e ARTs integra o mesmo módulo e a mesma ação
-- já autorizados por technical-archive.create. Nenhuma permissão duplicada é criada.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'technical-archive.create') THEN
    RAISE EXCEPTION 'required permission technical-archive.create is missing';
  END IF;
END;
$$;
