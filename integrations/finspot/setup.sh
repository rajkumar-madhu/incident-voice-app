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
#   1-3. Sign up the Finspot organization and admin (or log in if it exists)
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

# ---- Steps 1-3: Sign up (organization + admin), or log in if it already exists ----
json_get() {
  python3 -c "import sys,json
d=json.load(sys.stdin)
for k in sys.argv[1].split('.'):
    d=d.get(k,{}) if isinstance(d,dict) else {}
print(d if isinstance(d,str) else '')" "$1" 2>/dev/null || echo ""
}

echo "Step 1: Signing up organization '$TENANT_NAME'..."
AUTH_RESPONSE=$(curl -sf "$AUTH_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"organizationName\": \"$TENANT_NAME\",
    \"name\": \"$ADMIN_NAME\",
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }" 2>&1) || {
  echo "  Account may already exist, logging in instead..."
  AUTH_RESPONSE=$(curl -sf "$AUTH_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$ADMIN_EMAIL\",
      \"password\": \"$ADMIN_PASSWORD\"
    }") || AUTH_RESPONSE=""
}

TENANT_ID=$(echo "$AUTH_RESPONSE" | json_get data.tenant.id)
[ -z "$TENANT_ID" ] && TENANT_ID=$(echo "$AUTH_RESPONSE" | json_get data.user.tenant_id)
JWT_TOKEN=$(echo "$AUTH_RESPONSE" | json_get data.tokens.accessToken)

if [ -z "$TENANT_ID" ] || [ -z "$JWT_TOKEN" ]; then
  echo "  ERROR: Sign-up and login both failed."
  exit 1
fi
echo "  Tenant ID: $TENANT_ID"
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
