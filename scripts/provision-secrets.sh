#!/usr/bin/env bash
set -euo pipefail

# ─── WeCrew Voice SaaS — Secret Provisioning ───
# Interactive script to generate and apply K8s secrets.
# Run after bootstrap-cluster.sh, before deploying workloads.

echo "══════════════════════════════════════════════════"
echo "  WeCrew Voice — Secret Provisioning"
echo "══════════════════════════════════════════════════"
echo ""

# ─── Generate Cryptographic Secrets ───
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
EMAIL_ENCRYPTION_KEY=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 32)

echo "Generated cryptographic secrets (JWT, encryption keys)."
echo ""

# ─── Prompt for User-Provided Secrets ───
read -rp "PostgreSQL password: " DB_PASSWORD
read -rp "Redis password: " REDIS_PASSWORD
read -rp "Flowise username [admin]: " FLOWISE_USERNAME
FLOWISE_USERNAME="${FLOWISE_USERNAME:-admin}"
read -rp "Flowise password: " FLOWISE_PASSWORD
read -rp "Anthropic API key (or press Enter to skip): " ANTHROPIC_API_KEY
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-not-set}"
read -rp "OpenAI API key (or press Enter to skip): " OPENAI_API_KEY
OPENAI_API_KEY="${OPENAI_API_KEY:-not-set}"

# Construct DATABASE_URL and REDIS_URL
DB_HOST="postgres-svc.voice-saas-data.svc.cluster.local"
REDIS_HOST="redis-svc.voice-saas-data.svc.cluster.local"
DATABASE_URL="postgresql://voice_saas:${DB_PASSWORD}@${DB_HOST}:5432/voice_saas"
REDIS_URL="redis://:${REDIS_PASSWORD}@${REDIS_HOST}:6379/0"

echo ""
echo "► Creating voice-saas-secrets in voice-saas namespace..."
kubectl create secret generic voice-saas-secrets \
  --namespace=voice-saas \
  --from-literal=DATABASE_URL="${DATABASE_URL}" \
  --from-literal=DATABASE_PASSWORD="${DB_PASSWORD}" \
  --from-literal=REDIS_URL="${REDIS_URL}" \
  --from-literal=REDIS_PASSWORD="${REDIS_PASSWORD}" \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}" \
  --from-literal=EMAIL_ENCRYPTION_KEY="${EMAIL_ENCRYPTION_KEY}" \
  --from-literal=WEBHOOK_SECRET="${WEBHOOK_SECRET}" \
  --from-literal=FLOWISE_USERNAME="${FLOWISE_USERNAME}" \
  --from-literal=FLOWISE_PASSWORD="${FLOWISE_PASSWORD}" \
  --from-literal=ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
  --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "  ✓ voice-saas-secrets created"

echo ""
echo "► Creating postgres-credentials in voice-saas-data namespace..."
kubectl create secret generic postgres-credentials \
  --namespace=voice-saas-data \
  --from-literal=POSTGRES_PASSWORD="${DB_PASSWORD}" \
  --from-literal=POSTGRES_USER="voice_saas" \
  --from-literal=POSTGRES_DB="voice_saas" \
  --from-literal=DATABASE_URL="${DATABASE_URL}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "  ✓ postgres-credentials created"

echo ""
echo "► Creating redis-credentials in voice-saas-data namespace..."
kubectl create secret generic redis-credentials \
  --namespace=voice-saas-data \
  --from-literal=REDIS_PASSWORD="${REDIS_PASSWORD}" \
  --from-literal=REDIS_URL="${REDIS_URL}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "  ✓ redis-credentials created"

echo ""
echo "► Creating flowise-basic-auth for ingress..."
# Generate htpasswd for nginx basic auth
if command -v htpasswd &>/dev/null; then
  HTPASSWD=$(htpasswd -bn "${FLOWISE_USERNAME}" "${FLOWISE_PASSWORD}")
else
  # Fallback: use openssl
  HTPASSWD="${FLOWISE_USERNAME}:$(openssl passwd -apr1 "${FLOWISE_PASSWORD}")"
fi

kubectl create secret generic flowise-basic-auth \
  --namespace=voice-saas \
  --from-literal=auth="${HTPASSWD}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "  ✓ flowise-basic-auth created"

echo ""
echo "══════════════════════════════════════════════════"
echo "  Secrets provisioned successfully!"
echo ""
echo "  Secrets created:"
echo "    voice-saas/voice-saas-secrets"
echo "    voice-saas-data/postgres-credentials"
echo "    voice-saas-data/redis-credentials"
echo "    voice-saas/flowise-basic-auth"
echo ""
echo "  Next: scripts/run-migrations.sh"
echo "══════════════════════════════════════════════════"
