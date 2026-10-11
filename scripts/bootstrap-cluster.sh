#!/usr/bin/env bash
set -euo pipefail

# ─── WeCrew Voice SaaS — Cluster Bootstrap ───
# Installs all cluster prerequisites for the voice-saas platform.
# Run once on a fresh cluster before deploying workloads.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "══════════════════════════════════════════════════"
echo "  WeCrew Voice — Cluster Bootstrap"
echo "══════════════════════════════════════════════════"

# ─── 1. Create Namespaces ───
echo ""
echo "► Creating namespaces..."
kubectl create namespace voice-saas --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace voice-saas-data --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace ingress --dry-run=client -o yaml | kubectl apply -f -

# Label namespaces for network policies
kubectl label namespace voice-saas kubernetes.io/metadata.name=voice-saas --overwrite
kubectl label namespace voice-saas-data kubernetes.io/metadata.name=voice-saas-data --overwrite
kubectl label namespace monitoring kubernetes.io/metadata.name=monitoring --overwrite
kubectl label namespace ingress kubernetes.io/metadata.name=ingress --overwrite

echo "  ✓ Namespaces created and labeled"

# ─── 2. Install NGINX Ingress Controller ───
echo ""
echo "► Installing NGINX Ingress Controller..."
if ! helm repo list 2>/dev/null | grep -q ingress-nginx; then
  helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
fi
helm repo update ingress-nginx

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress \
  --set controller.replicaCount=2 \
  --set controller.metrics.enabled=true \
  --set controller.podAnnotations."prometheus\.io/scrape"="true" \
  --set controller.podAnnotations."prometheus\.io/port"="10254" \
  --wait --timeout 5m

echo "  ✓ NGINX Ingress Controller installed"

# ─── 3. Install cert-manager ───
echo ""
echo "► Installing cert-manager..."
if ! helm repo list 2>/dev/null | grep -q jetstack; then
  helm repo add jetstack https://charts.jetstack.io
fi
helm repo update jetstack

helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set crds.enabled=true \
  --wait --timeout 5m

# Apply ClusterIssuers
echo "  Applying ClusterIssuers..."
kubectl apply -f "$ROOT_DIR/k8s/base/cert-manager/cluster-issuer.yaml"

echo "  ✓ cert-manager installed with Let's Encrypt issuers"

# ─── 4. Install External Secrets Operator (optional) ───
echo ""
echo "► Installing External Secrets Operator..."
if ! helm repo list 2>/dev/null | grep -q external-secrets; then
  helm repo add external-secrets https://charts.external-secrets.io
fi
helm repo update external-secrets

helm upgrade --install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --set installCRDs=true \
  --wait --timeout 5m

echo "  ✓ External Secrets Operator installed"

# ─── 5. Install metrics-server ───
echo ""
echo "► Installing metrics-server..."
if ! kubectl get deployment metrics-server -n kube-system &>/dev/null; then
  helm upgrade --install metrics-server metrics-server/metrics-server \
    --namespace kube-system \
    --set args="{--kubelet-insecure-tls}" \
    --wait --timeout 3m 2>/dev/null || \
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
fi

echo "  ✓ metrics-server available"

# ─── 6. Install NVIDIA Device Plugin (for GPU nodes) ───
echo ""
echo "► Installing NVIDIA device plugin..."
if kubectl get nodes -l nvidia.com/gpu.present=true --no-headers 2>/dev/null | grep -q .; then
  kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.14.5/nvidia-device-plugin.yml
  echo "  ✓ NVIDIA device plugin installed"
else
  echo "  ⊘ No GPU nodes detected — skipping NVIDIA device plugin"
fi

# ─── 7. Apply Priority Classes (cluster-scoped) ───
echo ""
echo "► Applying PriorityClasses..."
kubectl apply -f "$ROOT_DIR/k8s/base/priority-classes/priorities.yaml"
echo "  ✓ PriorityClasses created"

# ─── 8. Apply RBAC ───
echo ""
echo "► Applying RBAC..."
kubectl apply -f "$ROOT_DIR/k8s/base/rbac/service-account.yaml"
echo "  ✓ RBAC applied"

# ─── Summary ───
echo ""
echo "══════════════════════════════════════════════════"
echo "  Bootstrap complete!"
echo ""
echo "  Next steps:"
echo "    1. Run scripts/provision-secrets.sh"
echo "    2. Run scripts/run-migrations.sh"
echo "    3. Deploy with: kustomize build k8s/staging/ | kubectl apply -f -"
echo "    4. Verify with: scripts/smoke-test.sh"
echo "══════════════════════════════════════════════════"
