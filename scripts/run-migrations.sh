#!/usr/bin/env bash
set -euo pipefail

# ─── LinkedEye Voice Agent SaaS — Database Migrations ───
# Runs all SQL migration files against the PostgreSQL instance.
# Idempotent: safe to run multiple times (IF NOT EXISTS patterns).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "══════════════════════════════════════════════════"
echo "  LinkedEye Voice Agent — Database Migrations"
echo "══════════════════════════════════════════════════"
echo ""

# ─── Determine connection method ───
if [ -n "${DATABASE_URL:-}" ]; then
  PSQL_CMD="psql ${DATABASE_URL}"
  echo "Using DATABASE_URL from environment."
elif kubectl get pods -n voice-saas-data -l app=postgres --no-headers 2>/dev/null | grep -q Running; then
  echo "Setting up port-forward to PostgreSQL pod..."
  kubectl port-forward -n voice-saas-data svc/postgres-svc 15432:5432 &
  PF_PID=$!
  sleep 3

  # Get password from secret
  DB_PASSWORD=$(kubectl get secret postgres-credentials -n voice-saas-data -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)
  PSQL_CMD="psql postgresql://voice_saas:${DB_PASSWORD}@localhost:15432/voice_saas"

  # Cleanup port-forward on exit
  trap "kill $PF_PID 2>/dev/null || true" EXIT
  echo "Port-forward established on localhost:15432."
else
  echo "Error: No DATABASE_URL set and no PostgreSQL pod found."
  echo "Ensure PostgreSQL is running or set DATABASE_URL."
  exit 1
fi

echo ""

# ─── Run migrations in dependency order ───
run_migration() {
  local service="$1"
  local migration_dir="$2"

  if [ ! -d "$migration_dir" ]; then
    echo "  ⊘ No migrations directory for ${service} — skipping"
    return 0
  fi

  local count=0
  for sql_file in "$migration_dir"/*.sql; do
    [ -f "$sql_file" ] || continue
    echo "  Applying: $(basename "$sql_file")"
    $PSQL_CMD -f "$sql_file" -v ON_ERROR_STOP=1
    count=$((count + 1))
  done

  if [ "$count" -eq 0 ]; then
    echo "  ⊘ No SQL files found — skipping"
  else
    echo "  ✓ ${service}: ${count} migration(s) applied"
  fi
}

# 1. Auth schema (foundation — tenants, users, api_keys, RLS)
echo "► [1/4] Auth service migrations..."
run_migration "auth" "$ROOT_DIR/services/auth/src/db/migrations"

echo ""

# 2. Orchestrator schema
echo "► [2/4] Orchestrator service migrations..."
run_migration "orchestrator" "$ROOT_DIR/services/orchestrator/src/db/migrations"

echo ""

# 3. Email schema
echo "► [3/4] Email service migrations..."
run_migration "email" "$ROOT_DIR/services/email/src/db/migrations"

echo ""

# 4. RAG schema
echo "► [4/4] RAG service migrations..."
run_migration "rag" "$ROOT_DIR/services/rag/migrations"

echo ""
echo "══════════════════════════════════════════════════"
echo "  All migrations completed successfully!"
echo ""
echo "  Next: Deploy services and run scripts/smoke-test.sh"
echo "══════════════════════════════════════════════════"
