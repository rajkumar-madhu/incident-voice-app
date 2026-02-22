#!/usr/bin/env bash
set -euo pipefail

# ─── LinkedEye Voice Agent SaaS — Smoke Tests ───
# Verifies all services are running and healthy after deployment.

echo "══════════════════════════════════════════════════"
echo "  LinkedEye Voice Agent — Smoke Tests"
echo "══════════════════════════════════════════════════"
echo ""

PASS=0
FAIL=0
WARN=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" -eq 0 ]; then
    echo "  ✓ ${name}"
    PASS=$((PASS + 1))
  else
    echo "  ✗ ${name}"
    FAIL=$((FAIL + 1))
  fi
}

warn() {
  local name="$1"
  echo "  ⚠ ${name}"
  WARN=$((WARN + 1))
}

# ─── 1. Pod Status ───
echo "► Checking pod status..."
SERVICES=(auth api-gateway orchestrator email webvoice stt tts rag flowise)

for svc in "${SERVICES[@]}"; do
  READY=$(kubectl get pods -n voice-saas -l app="$svc" --no-headers 2>/dev/null | grep -c Running || echo 0)
  if [ "$READY" -gt 0 ]; then
    check "Pod ${svc}: ${READY} running" 0
  else
    check "Pod ${svc}: not running" 1
  fi
done

# Check data layer
for svc in postgres redis; do
  READY=$(kubectl get pods -n voice-saas-data -l app="$svc" --no-headers 2>/dev/null | grep -c Running || echo 0)
  if [ "$READY" -gt 0 ]; then
    check "Pod ${svc}: ${READY} running" 0
  else
    check "Pod ${svc}: not running" 1
  fi
done

echo ""

# ─── 2. Health Endpoints ───
echo "► Checking health endpoints..."

# Set up port-forwards for health checks
declare -A SVC_PORTS=(
  [auth]=4001
  [api-gateway]=4000
  [orchestrator]=4002
  [email]=4003
  [webvoice]=4004
  [stt]=8001
  [tts]=8002
  [rag]=8003
)

PF_PIDS=()
LOCAL_PORT=19000

for svc in "${!SVC_PORTS[@]}"; do
  PORT="${SVC_PORTS[$svc]}"
  LOCAL_PORT=$((LOCAL_PORT + 1))
  kubectl port-forward -n voice-saas "svc/${svc}" "${LOCAL_PORT}:${PORT}" &>/dev/null &
  PF_PIDS+=($!)
  SVC_LOCAL_PORTS[$svc]=$LOCAL_PORT
done 2>/dev/null || true

# Wait for port-forwards to establish
sleep 3

# Cleanup port-forwards on exit
cleanup() {
  for pid in "${PF_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

for svc in "${!SVC_PORTS[@]}"; do
  LOCAL=${SVC_LOCAL_PORTS[$svc]:-0}
  if [ "$LOCAL" -eq 0 ]; then
    warn "Health ${svc}: port-forward not available"
    continue
  fi

  # Check /health
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${LOCAL}/health" --connect-timeout 5 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    check "Health ${svc} /health: 200" 0
  else
    check "Health ${svc} /health: ${HTTP_CODE}" 1
  fi
done

echo ""

# ─── 3. Metrics Endpoints ───
echo "► Checking /metrics endpoints..."
for svc in "${!SVC_PORTS[@]}"; do
  LOCAL=${SVC_LOCAL_PORTS[$svc]:-0}
  [ "$LOCAL" -eq 0 ] && continue

  METRICS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${LOCAL}/metrics" --connect-timeout 5 2>/dev/null || echo "000")
  if [ "$METRICS_CODE" = "200" ]; then
    check "Metrics ${svc}: Prometheus format" 0
  else
    warn "Metrics ${svc}: ${METRICS_CODE}"
  fi
done

echo ""

# ─── 4. Ingress ───
echo "► Checking ingress..."
INGRESS_IP=$(kubectl get ingress -n voice-saas voice-saas-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
if [ -n "$INGRESS_IP" ]; then
  check "Ingress has external IP: ${INGRESS_IP}" 0

  # Test TLS (if host is configured in DNS)
  TLS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --resolve "api.linkedeye.com:443:${INGRESS_IP}" "https://api.linkedeye.com/health" --connect-timeout 5 2>/dev/null || echo "000")
  if [ "$TLS_STATUS" = "200" ]; then
    check "Ingress TLS termination: working" 0
  else
    warn "Ingress TLS: ${TLS_STATUS} (DNS may not be configured)"
  fi
else
  warn "Ingress: no external IP assigned yet"
fi

echo ""

# ─── 5. WebSocket ───
echo "► Checking WebSocket connectivity..."
WS_SVC_PORT=${SVC_LOCAL_PORTS[webvoice]:-0}
if [ "$WS_SVC_PORT" -gt 0 ]; then
  WS_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGVzdA==" \
    "http://localhost:${WS_SVC_PORT}/socket.io/?EIO=4&transport=polling" \
    --connect-timeout 5 2>/dev/null || echo "000")
  if [ "$WS_CHECK" = "200" ]; then
    check "WebSocket: Socket.IO polling available" 0
  else
    warn "WebSocket: ${WS_CHECK}"
  fi
else
  warn "WebSocket: port-forward not available"
fi

echo ""

# ─── Summary ───
echo "══════════════════════════════════════════════════"
echo "  Smoke Test Results"
echo ""
echo "  Passed:   ${PASS}"
echo "  Failed:   ${FAIL}"
echo "  Warnings: ${WARN}"
echo ""
if [ "$FAIL" -gt 0 ]; then
  echo "  STATUS: FAILED — ${FAIL} check(s) failed"
  exit 1
else
  echo "  STATUS: PASSED"
fi
echo "══════════════════════════════════════════════════"
