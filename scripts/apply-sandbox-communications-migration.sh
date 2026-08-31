#!/usr/bin/env bash
# Apply 20260829180000_communication_attempts.sql to the sandbox project only.
# Never links, queries, or migrates production.
set -euo pipefail

SANDBOX_REF="edavgiskqqbklfnfaysd"
SANDBOX_NAME="pillar-deal-room-sandbox"
PROD_REF="lxwuqjpletmnbphfxlgo"
MIGRATION="20260829180000"

refuse_production() {
  local label="$1"
  local value="$2"
  if [[ "$value" == *"$PROD_REF"* ]]; then
    echo "Refusing: $label points at production ($PROD_REF)." >&2
    exit 1
  fi
}

for name in NEXT_PUBLIC_SUPABASE_URL SUPABASE_DB_URL DATABASE_URL SUPABASE_PROJECT_REF; do
  refuse_production "$name" "${!name:-}"
done

if [[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" && "${NEXT_PUBLIC_SUPABASE_URL}" != *"$SANDBOX_REF"* ]]; then
  echo "Refusing: NEXT_PUBLIC_SUPABASE_URL is not the sandbox project $SANDBOX_REF." >&2
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" && -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Set SUPABASE_ACCESS_TOKEN or SUPABASE_DB_URL for $SANDBOX_NAME ($SANDBOX_REF) only." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Confirming Management API target is $SANDBOX_NAME ($SANDBOX_REF)..."
  project_json="$(curl -fsS \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$SANDBOX_REF")"
  echo "$project_json" | python3 -c "
import json, sys
p = json.load(sys.stdin)
ref = p.get('id') or p.get('ref')
name = p.get('name')
print(f\"linked project: {name} ({ref})\")
if ref != '$SANDBOX_REF':
    raise SystemExit(f'Refusing unexpected project ref {ref}')
if name and name != '$SANDBOX_NAME':
    raise SystemExit(f'Refusing unexpected project name {name}')
"
  refuse_production "management project" "$project_json"
  echo "Linking CLI to sandbox $SANDBOX_REF only..."
  npx supabase link --project-ref "$SANDBOX_REF" --yes
  linked="$(npx supabase projects list -o json 2>/dev/null || true)"
  refuse_production "supabase projects list" "$linked"
  echo "Pushing migrations to sandbox..."
  npx supabase db push
else
  refuse_production "SUPABASE_DB_URL" "$SUPABASE_DB_URL"
  if [[ "$SUPABASE_DB_URL" != *"$SANDBOX_REF"* ]]; then
    echo "Refusing: SUPABASE_DB_URL does not include sandbox ref $SANDBOX_REF." >&2
    exit 1
  fi
  echo "Pushing migrations through the sandbox database URL..."
  npx supabase db push --db-url "$SUPABASE_DB_URL"
fi

echo "Verifying sandbox schema..."
npx supabase db query --linked "
select
  to_regclass('public.communication_attempts') as communication_attempts,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'last_response_at'
  ) as tasks_last_response_at,
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.communication_attempts'::regclass
  ) as rls_enabled,
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.communication_attempts'::regclass
      and conname = 'communication_attempts_outbound_sent_false'
  ) as outbound_sent_cannot_be_true,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.communication_attempts'::regclass
      and tgname = 'communication_attempts_enforce_same_deal'
  ) as same_deal_trigger,
  exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '$MIGRATION'
  ) as migration_recorded;
" 2>/dev/null || npx supabase inspect db table-sizes >/dev/null

echo "Sandbox communications migration complete. Production was not touched."
