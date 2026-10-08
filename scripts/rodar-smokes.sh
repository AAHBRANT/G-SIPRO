#!/usr/bin/env bash
# Roda TODOS os smokes do G-SIPRO, de ponta a ponta, num banco ZERADO.
#
# ⚠️ APAGA o banco antes de começar (DROP SCHEMA public). Por isso só aceita o
# PostgreSQL local de teste em localhost:5433/gsipro — a mesma trava que cada
# smoke já tem. Nunca aponte para homologação.
#
# A ordem importa: os smokes formam uma corrente (um cria a licitação que o
# outro usa, a retificação cria o requisito que a matriz precisa, a proposta
# cria o edital da concorrência...). Ordem levantada em 08/10/2026 rodando a
# corrente inteira do zero.
#
# Fora daqui: smoke-ai-extraction (precisa de chave da OpenAI).
#
# Uso:  DATABASE_URL="postgresql://<usuario>:<senha>@localhost:5433/gsipro?schema=public" scripts/rodar-smokes.sh
# Sem Postgres instalado, um portátil serve (npm i embedded-postgres, porta 5433).
set -u
cd "$(dirname "$0")/.."
if ! echo "${DATABASE_URL:-}" | grep -qE '@(localhost|127\.0\.0\.1):5433/gsipro(\?|$)'; then
  echo "Recusado: DATABASE_URL precisa apontar para o PostgreSQL local de teste em localhost:5433/gsipro." >&2
  exit 2
fi
# Variáveis só para o código carregar fora do servidor: valores de mentira,
# os mesmos que a CI usa no build. Não dão acesso a nada.
export NODE_ENV=development AUTH_SECRET=build-only-auth-secret-0000000000000000 AUTH_URL=http://localhost:3001 \
  ENTRA_TENANT_ID=00000000-0000-4000-8000-000000000000 ENTRA_CLIENT_ID=00000000-0000-4000-8000-000000000000 \
  ENTRA_CLIENT_SECRET=build-only-not-a-client-secret
L="${TMPDIR:-${TEMP:-/tmp}}/gsipro-smokes"; rm -rf "$L"; mkdir -p "$L"
sql(){ node -e 'const pg=require("pg");const c=new pg.Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query(process.argv[1])).then(r=>{if(r.rows&&r.rows.length)console.log(JSON.stringify(r.rows));return c.end()}).catch(e=>{console.error(e.message);process.exit(1)})' "$1"; }
sql "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null
npx pnpm prisma migrate deploy > "$L/migrate.log" 2>&1 || { echo "MIGRATE FALHOU"; exit 1; }
DONO=11111111-1111-4111-8111-111111111111; SEG=22222222-2222-4222-8222-222222222222
sql "INSERT INTO users (id,\"entraObjectId\",\"displayName\",email,\"isMaster\",\"isOwner\",\"createdBy\",\"updatedBy\",\"updatedAt\") VALUES ('$DONO','$DONO','Teste Dono','dono@teste.local',true,true,'$DONO','$DONO',now()),('$SEG','$SEG','Teste Analista','analista@teste.local',false,false,'$DONO','$DONO',now())"
sql "UPDATE users SET status='INACTIVE' WHERE id='$SEG'"
roda(){ for n in "$@"; do timeout 300 ./node_modules/.bin/tsx "scripts/$n.ts" > "$L/$n.log" 2>&1; r=$?; if [ $r -eq 0 ]; then echo "OK    $n" | tee -a "$L/resultado.txt"; else echo "FALHA $n :: $(grep -vE '^\s+at |node:internal|^\s*[0-9]+ |^\s*\^|^\s*\||^\{"level"|^$' "$L/$n.log" | tail -1 | cut -c1-170)" | tee -a "$L/resultado.txt"; fi; done; }
echo "-- fase 1: um usuário ativo"
roda smoke-archive-search smoke-escalation-resets-attempts smoke-support-triage-notification \
     smoke-tender smoke-document smoke-experience smoke-requirement smoke-technical-evidence \
     smoke-analysis smoke-rectification smoke-compliance-matrix smoke-deadline smoke-matrix-evidence smoke-professionals \
     smoke-item-assessment smoke-matrix-export \
     smoke-proposal smoke-proposal-version smoke-technical-sections smoke-technical-review smoke-i3-commercial-submission \
     smoke-i4-competition smoke-competition-acts
echo "-- fase 2: dois usuários autorizados (segregação)"
sql "UPDATE users SET status='ACTIVE' WHERE id='$SEG'"
sql "INSERT INTO user_profiles (\"userId\",\"profileId\",\"grantedBy\",reason) VALUES ('$DONO','a2100000-0000-4000-8000-000000000001','$DONO','teste local'),('$SEG','a2100000-0000-4000-8000-000000000001','$DONO','teste local') ON CONFLICT DO NOTHING"
roda smoke-ai-governance smoke-competition-results smoke-indicator-catalog smoke-indicator-row-security smoke-indicator-calculations smoke-indicator-publication smoke-indicator-reconciliation
echo "-- fase 3: Buscador (PNCP real; cria usuário próprio, por isso por último)"
roda smoke-scouting
echo
falhas=$(grep -c "^FALHA" "$L/resultado.txt" 2>/dev/null || true)
echo "Logs em $L"
[ "${falhas:-0}" -eq 0 ] && echo "TODOS OS SMOKES PASSARAM" || { echo "${falhas} SMOKE(S) FALHARAM"; exit 1; }
