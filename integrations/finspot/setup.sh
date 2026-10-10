#!/bin/bash
#
# Finspot Voice Agent - Complete Setup Script
#
# Prerequisites:
#   - Docker Compose services running (docker compose up -d)
#   - Auth service reachable
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# This script will:
#   1. Create a Finspot tenant
#   2. Register an admin user
#   3. Login to get JWT token
#   4. Create an API key (for REST/WebSocket)
#   5. Create an agent with webhook config
#   6. Save all credentials to .env
#   7. Print embed snippet for Finspot pages

set -e

# ---- Configuration ----
AUTH_URL="${AUTH_URL:-https://voice.api.santhira.com}"
GATEWAY_URL="${GATEWAY_URL:-https://voice.api.santhira.com}"
WEBVOICE_URL="${WEBVOICE_URL:-https://voice.santhira.com}"
FINSPOT_URL="${FINSPOT_URL:-https://fs-le-dev-inc.finspot.in}"
RECEIVER_PORT="${RECEIVER_PORT:-3100}"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@finspot.in}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-FinspotAdmin@2026!}"
ADMIN_NAME="${ADMIN_NAME:-Finspot Admin}"
TENANT_NAME="${TENANT_NAME:-Finspot}"
PLAN="${PLAN:-pro}"

WEBHOOK_SECRET="fswh_$(openssl rand -hex 16)"

echo "============================================================"
echo "  Finspot Voice Agent - Complete Setup"
echo "============================================================"
echo ""
echo "  Auth URL:    $AUTH_URL"
echo "  Gateway URL: $GATEWAY_URL"
echo "  Finspot URL: $FINSPOT_URL"
echo ""

# ---- Check connectivity ----
echo "Checking auth service..."
if ! curl -sf "$AUTH_URL/health" > /dev/null 2>&1; then
  echo ""
  echo "ERROR: Auth service not reachable at $AUTH_URL"
  echo ""
  echo "Start services first:"
  echo "  docker compose up -d"
  echo ""
  echo "Or set AUTH_URL if running elsewhere:"
  echo "  AUTH_URL=https://your-server:4001 ./setup.sh"
  exit 1
fi
echo "  Auth service is healthy."
echo ""

# ---- Step 1: Create Tenant ----
echo "Step 1: Creating tenant '$TENANT_NAME'..."
TENANT_RESPONSE=$(curl -sf "$AUTH_URL/tenants" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$TENANT_NAME\",
    \"email\": \"$ADMIN_EMAIL\",
    \"plan\": \"$PLAN\"
  }" 2>&1) || {
  echo "  Tenant may already exist, trying to continue..."
  TENANT_RESPONSE=""
}

if [ -n "$TENANT_RESPONSE" ]; then
  TENANT_ID=$(echo "$TENANT_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tenant',{}).get('id', d.get('data',{}).get('id','')))" 2>/dev/null || echo "")
  if [ -z "$TENANT_ID" ]; then
    # Try jq if available
    TENANT_ID=$(echo "$TENANT_RESPONSE" | jq -r '.data.tenant.id // .data.id // empty' 2>/dev/null || echo "")
  fi
fi

if [ -z "$TENANT_ID" ]; then
  echo "  Could not extract tenant_id. Please enter it manually."
  read -p "  Tenant ID: " TENANT_ID
fi
echo "  Tenant ID: $TENANT_ID"
echo ""

# ---- Step 2: Register Admin User ----
echo "Step 2: Registering admin user..."
REGISTER_RESPONSE=$(curl -sf "$AUTH_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenant_id\": \"$TENANT_ID\",
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"name\": \"$ADMIN_NAME\",
    \"role\": \"admin\"
  }" 2>&1) || {
  echo "  User may already exist, logging in instead..."
}
echo "  Admin user ready."
echo ""

# ---- Step 3: Login ----
echo "Step 3: Logging in..."
LOGIN_RESPONSE=$(curl -sf "$AUTH_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"tenant_id\": \"$TENANT_ID\"
  }")

JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null || echo "")
if [ -z "$JWT_TOKEN" ]; then
  JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.tokens.accessToken // empty' 2>/dev/null || echo "")
fi

if [ -z "$JWT_TOKEN" ]; then
  echo "  ERROR: Login failed. Response:"
  echo "  $LOGIN_RESPONSE"
  exit 1
fi
echo "  JWT Token: ${JWT_TOKEN:0:20}..."
echo ""

# ---- Step 4: Create API Key ----
echo "Step 4: Creating API key..."
APIKEY_RESPONSE=$(curl -sf "$AUTH_URL/api-keys" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "finspot-voice-integration",
    "scopes": ["voice:read", "voice:write", "read", "write"]
  }')

RAW_KEY=$(echo "$APIKEY_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('rawKey',''))" 2>/dev/null || echo "")
if [ -z "$RAW_KEY" ]; then
  RAW_KEY=$(echo "$APIKEY_RESPONSE" | jq -r '.data.rawKey // empty' 2>/dev/null || echo "")
fi

if [ -z "$RAW_KEY" ]; then
  echo "  ERROR: Could not create API key. Response:"
  echo "  $APIKEY_RESPONSE"
  exit 1
fi
echo "  API Key: ${RAW_KEY:0:16}..."
echo "  >>> SAVE THIS KEY - shown only once! <<<"
echo ""

# ---- Step 5: Create Agent with Webhook ----
echo "Step 5: Creating agent with webhook..."
AGENT_RESPONSE=$(curl -sf "$AUTH_URL/agents" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"finspot-itsm-agent\",
    \"description\": \"Finspot ITSM voice agent - handles incidents, problems, and change requests\",
    \"system_prompt\": \"You are a Finspot IT support voice assistant. Help users report incidents (outages, errors), log recurring problems, and process change requests (access, upgrades). Ask about business impact, affected users, and urgency. Summarize the issue back before confirming.\",
    \"language\": \"en\",
    \"greeting_message\": \"Hello, this is Finspot IT support. How can I help you today?\",
    \"webhook_url\": \"${FINSPOT_URL}:${RECEIVER_PORT}/api/webhooks/voice\",
    \"webhook_events\": [
      \"call.started\", \"call.transcribed\", \"call.responded\",
      \"call.completed\", \"call.failed\", \"call.abandoned\",
      \"incident.created\", \"problem.created\", \"change.requested\"
    ],
    \"webhook_secret\": \"$WEBHOOK_SECRET\"
  }")

AGENT_ID=$(echo "$AGENT_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null || echo "")
if [ -z "$AGENT_ID" ]; then
  AGENT_ID=$(echo "$AGENT_RESPONSE" | jq -r '.data.id // empty' 2>/dev/null || echo "")
fi
echo "  Agent ID: $AGENT_ID"
echo "  Webhook: ${FINSPOT_URL}:${RECEIVER_PORT}/api/webhooks/voice"
echo ""

# ---- Step 6: Save .env ----
echo "Step 6: Saving credentials to .env..."
cat > .env << ENVEOF
# Finspot Voice Agent Integration
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

PORT=$RECEIVER_PORT
WEBHOOK_SECRET=$WEBHOOK_SECRET

# Voice Agent
VOICE_API_URL=$GATEWAY_URL
VOICE_WS_URL=$WEBVOICE_URL

# Auth
API_KEY=$RAW_KEY
TENANT_ID=$TENANT_ID
AGENT_ID=$AGENT_ID

# Finspot
FINSPOT_APP_URL=$FINSPOT_URL
ENVEOF
echo "  Saved to .env"
echo ""

# ---- Done ----
echo "============================================================"
echo "  SETUP COMPLETE"
echo "============================================================"
echo ""
echo "  Tenant ID:      $TENANT_ID"
echo "  API Key:         ${RAW_KEY:0:16}..."
echo "  Agent ID:        $AGENT_ID"
echo "  Webhook Secret:  ${WEBHOOK_SECRET:0:16}..."
echo "  Webhook URL:     ${FINSPOT_URL}:${RECEIVER_PORT}/api/webhooks/voice"
echo ""
echo "  --- Next Steps ---"
echo ""
echo "  1. Start the webhook receiver:"
echo "     cd integrations/finspot && npm install && npm run dev"
echo ""
echo "  2. Add this to any Finspot page:"
echo ""
echo "     <script"
echo "       src=\"${WEBVOICE_URL}/integrations/finspot-embed.js\""
echo "       data-api-key=\"$RAW_KEY\""
echo "       data-tenant-id=\"$TENANT_ID\""
echo "       data-lang=\"en\">"
echo "     </script>"
echo ""
echo "  3. Test the webhook:"
echo "     curl -X POST http://localhost:${RECEIVER_PORT}/api/webhooks/voice \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -H 'X-API-Key: $WEBHOOK_SECRET' \\"
echo "       -H 'X-Webhook-Event: call.completed' \\"
echo "       -d '{\"event\":\"call.completed\",\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"agent\":{\"id\":\"test\",\"name\":\"test\"},\"call\":{\"session_id\":\"test-123\",\"conversation_id\":null,\"channel\":\"web\",\"direction\":\"inbound\",\"status\":\"completed\",\"started_at\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"ended_at\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"duration_seconds\":30,\"turn_count\":3,\"transcript_summary\":\"User reported server outage\",\"user_sentiment\":\"negative\",\"caller_number\":\"+91123456789\"},\"latency\":{\"stt_ms\":800,\"llm_ms\":1200,\"tts_ms\":500,\"total_ms\":2500},\"itsm\":{\"type\":\"incident\",\"priority\":\"critical\",\"category\":\"service_disruption\",\"summary\":\"Server outage reported\"},\"metadata\":{}}'"
echo ""
echo "  4. Check the dashboard:"
echo "     curl http://localhost:${RECEIVER_PORT}/api/voice/stats"
echo ""
