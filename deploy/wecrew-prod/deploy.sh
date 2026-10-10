#!/usr/bin/env bash
# Build, push and deploy the dashboard, api-gateway and auth to the wecrew-prod cluster.
# Secrets live in deploy/wecrew-prod/.env (gitignored) and are generated on first run.
#
# Usage: deploy/wecrew-prod/deploy.sh [--skip-build] [--dry-run]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
NS=voice-app
REGISTRY=harbor.wecrew.in/library
CONTEXT="${KUBE_CONTEXT:-wecrew-prod}"
SKIP_BUILD=false
DRY_RUN=""

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --dry-run) DRY_RUN="--dry-run=client" ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
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

IMAGE_TAG="${IMAGE_TAG:-$(git -C "$ROOT" rev-parse --short HEAD)}"
export IMAGE_TAG
kc() { kubectl --context "$CONTEXT" "$@"; }

if [ "$SKIP_BUILD" = false ]; then
  for svc in auth api-gateway dashboard; do
    image="$REGISTRY/voice-$svc:$IMAGE_TAG"
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
envsubst '${IMAGE_TAG}' < "$HERE/apps.yaml" | kc apply $DRY_RUN -f -
kc apply $DRY_RUN -f "$HERE/ingress.yaml"

if [ -n "$DRY_RUN" ]; then exit 0; fi

kc -n "$NS" rollout status statefulset/postgres --timeout=180s
for d in redis auth api-gateway dashboard; do
  kc -n "$NS" rollout status "deployment/$d" --timeout=180s
done
echo "Deployed $IMAGE_TAG to https://ai.voice.wecrew.in"
