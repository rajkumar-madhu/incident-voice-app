#!/usr/bin/env bash
# Build, push and deploy the dashboard, api-gateway and auth to the wecrew-prod cluster.
# Secrets live in deploy/wecrew-prod/.env (gitignored) and are generated on first run.
#
# Usage:
#   deploy/wecrew-prod/deploy.sh [--skip-build] [--dry-run]
#   deploy/wecrew-prod/deploy.sh --only dashboard   # frontend-only; keeps auth/gateway tags on cluster
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
NS=voice-app
REGISTRY=harbor.wecrew.in/library
CONTEXT="${KUBE_CONTEXT:-wecrew-prod}"
SKIP_BUILD=false
DRY_RUN=""
ONLY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true ;;
    --dry-run) DRY_RUN="--dry-run=client" ;;
    --only)
      shift
      ONLY="${1:-}"
      [ -n "$ONLY" ] || { echo "--only requires a service (dashboard|auth|api-gateway|all)" >&2; exit 2; }
      ;;
    --only=*) ONLY="${1#--only=}" ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

ENV_FILE="$HERE/.env"
if [ ! -f "$ENV_FILE" ]; then
  umask 077
  {
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "REDIS_PASSWORD=$(openssl rand -hex 24)"
    echo "JWT_SECRET=$(openssl rand -hex 48)"
  } > "$ENV_FILE"
  echo "Generated secrets in $ENV_FILE"
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

TAG="$(git -C "$ROOT" rev-parse --short HEAD)"
IMAGE_TAG="${IMAGE_TAG:-$TAG}"
kc() { kubectl --context "$CONTEXT" "$@"; }

current_image_tag() {
  local deploy="$1" container="$2"
  kc -n "$NS" get deploy "$deploy" -o jsonpath="{.spec.template.spec.containers[?(@.name==\"$container\")].image}" 2>/dev/null \
    | sed 's/.*://' || true
}

export AUTH_IMAGE_TAG="${AUTH_IMAGE_TAG:-$IMAGE_TAG}"
export GATEWAY_IMAGE_TAG="${GATEWAY_IMAGE_TAG:-$IMAGE_TAG}"
export DASHBOARD_IMAGE_TAG="${DASHBOARD_IMAGE_TAG:-$IMAGE_TAG}"

if [ "$ONLY" = dashboard ]; then
  export DASHBOARD_IMAGE_TAG="$IMAGE_TAG"
  export AUTH_IMAGE_TAG="${AUTH_IMAGE_TAG:-$(current_image_tag auth auth)}"
  export GATEWAY_IMAGE_TAG="${GATEWAY_IMAGE_TAG:-$(current_image_tag api-gateway api-gateway)}"
  [ -n "$AUTH_IMAGE_TAG" ] && [ -n "$GATEWAY_IMAGE_TAG" ] || {
    echo "Could not read auth/gateway tags from cluster; set AUTH_IMAGE_TAG and GATEWAY_IMAGE_TAG" >&2
    exit 1
  }
fi

build_services=(auth api-gateway dashboard)
if [ "$ONLY" = dashboard ]; then
  build_services=(dashboard)
elif [ "$ONLY" = auth ]; then
  build_services=(auth)
elif [ "$ONLY" = api-gateway ]; then
  build_services=(api-gateway)
elif [ -n "$ONLY" ] && [ "$ONLY" != all ]; then
  echo "unknown --only value: $ONLY" >&2
  exit 2
fi

if [ "$SKIP_BUILD" = false ]; then
  for svc in "${build_services[@]}"; do
    case "$svc" in
      auth) tag="$AUTH_IMAGE_TAG" ;;
      api-gateway) tag="$GATEWAY_IMAGE_TAG" ;;
      dashboard) tag="$DASHBOARD_IMAGE_TAG" ;;
    esac
    image="$REGISTRY/voice-$svc:$tag"
    echo "Building $image"
    docker build --platform linux/amd64 -t "$image" "$ROOT/services/$svc"
    if [ -z "$DRY_RUN" ]; then docker push "$image"; fi
  done
fi

kc create namespace "$NS" --dry-run=client -o yaml | kc apply $DRY_RUN -f -

apply_secret() {
  local name="$1"; shift
  kc -n "$NS" create secret generic "$name" "$@" --dry-run=client -o yaml | kc apply $DRY_RUN -f -
}

apply_secret voice-app-secrets \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=REDIS_PASSWORD="$REDIS_PASSWORD"
apply_secret voice-app-auth-env \
  --from-literal=DATABASE_URL="postgresql://postgres:$POSTGRES_PASSWORD@postgres:5432/voice_saas" \
  --from-literal=REDIS_URL="redis://:$REDIS_PASSWORD@redis:6379/0" \
  --from-literal=JWT_SECRET="$JWT_SECRET"
apply_secret voice-app-gateway-env \
  --from-literal=REDIS_URL="redis://:$REDIS_PASSWORD@redis:6379/1" \
  --from-literal=JWT_SECRET="$JWT_SECRET"

kc -n "$NS" create configmap voice-app-migrations \
  --from-file="$ROOT/services/auth/src/db/migrations" --dry-run=client -o yaml | kc apply $DRY_RUN -f -

kc apply $DRY_RUN -f "$HERE/data.yaml" -f "$HERE/network.yaml"
envsubst '${AUTH_IMAGE_TAG} ${GATEWAY_IMAGE_TAG} ${DASHBOARD_IMAGE_TAG}' < "$HERE/apps.yaml" | kc apply $DRY_RUN -f -
kc apply $DRY_RUN -f "$HERE/ingress.yaml"

if [ -n "$DRY_RUN" ]; then exit 0; fi

kc -n "$NS" rollout status statefulset/postgres --timeout=180s
rollout=(redis auth api-gateway dashboard)
if [ "$ONLY" = dashboard ]; then
  rollout=(dashboard)
elif [ "$ONLY" = auth ]; then
  rollout=(auth)
elif [ "$ONLY" = api-gateway ]; then
  rollout=(api-gateway)
fi
for d in "${rollout[@]}"; do
  kc -n "$NS" rollout status "deployment/$d" --timeout=180s
done
echo "Deployed dashboard=${DASHBOARD_IMAGE_TAG} auth=${AUTH_IMAGE_TAG} gateway=${GATEWAY_IMAGE_TAG} → https://ai.voice.wecrew.in"
