# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

LinkedEye Voice Agent SaaS - a multi-tenant AI Voice Agent platform with 8 microservices, full infrastructure configs (Docker Compose, K8s, monitoring), and CI/CD pipelines.

**Voice Pipeline**: Audio In → STT (Whisper GPU) → RAG (pgvector) + Memory (Redis) → LLM (Claude via Flowise) → TTS (IndicF5 GPU / Piper fallback) → Audio Out

## Implementation Status

| Service | Type | Port | Location |
|---------|------|------|----------|
| Auth (JWT, API keys, tenants) | Node.js/Express | 4001 | `services/auth/src/` |
| API Gateway (routing, proxy, Twilio) | Node.js/Express | 4000 | `services/api-gateway/src/` |
| Orchestrator (conversation, LLM, RAG) | Node.js/Express | 4002 | `services/orchestrator/src/` |
| Email (IMAP/SMTP, BullMQ workers) | Node.js/Express | 4003 | `services/email/src/` |
| Webvoice (Socket.IO, VAD) | Node.js/Express | 4004 | `services/webvoice/src/` |
| STT (Faster Whisper) | Python/FastAPI | 8001 | `services/stt/` |
| TTS (IndicF5 + Piper fallback) | Python/FastAPI | 8002 | `services/tts/` |
| RAG (pgvector, nomic-embed-text) | Python/FastAPI | 8003 | `services/rag/` |
| Dashboard (Admin SPA) | React/Vite | 5173 | `services/dashboard/src/` |

Additional ports: Flowise 3000, Grafana 3001, PostgreSQL 5432, Redis 6379, Prometheus 9090, Ollama 11434.

## Architecture

**Node.js services** (auth, api-gateway, orchestrator, email, webvoice):
```
services/<name>/
├── src/
│   ├── index.ts          # Express app + middleware pipeline
│   ├── config.ts         # Env config (Zod-validated, exits on failure)
│   ├── routes/           # Express routers
│   ├── services/         # Business logic
│   ├── middleware/        # auth, rateLimiter, errorHandler
│   ├── db/               # postgres.ts, redis.ts, migrations/
│   ├── utils/            # logger.ts (pino), metrics.ts (prom-client)
│   ├── types/            # Zod schemas + TypeScript types (z.infer<>)
│   └── __tests__/        # Vitest unit tests
├── Dockerfile            # Multi-stage Node 20 Alpine
├── package.json
└── tsconfig.json         # target ES2022, module NodeNext, strict
```

**Python ML services** (stt, tts, rag):
```
services/<name>/
├── main.py               # FastAPI app + lifespan management
├── config.py             # Pydantic Settings configuration
├── middleware/            # error_handler.py, logging_middleware.py
├── models/               # ML model loaders + Pydantic schemas
├── routes/               # FastAPI routers (health, domain routes)
├── services/             # Business logic + cache_service.py
├── utils/                # logger.py (structlog), metrics.py
├── tests/                # pytest tests
├── requirements.txt
└── Dockerfile            # Python 3.10-slim multi-stage
```

**Dashboard frontend** (`services/dashboard/`): React 19 + Vite 6 + Tailwind + shadcn/ui + Recharts + TanStack Query. Pages: Dashboard, Call Logs, Analytics, Agents, API Keys, Billing, Settings. Backend API lives in the Auth service (`services/auth/src/routes/dashboard.ts`). Call log persistence uses Redis pub/sub (webvoice publishes, auth subscribes).

**Database migrations** are split per service:
- `services/auth/src/db/migrations/001_init_schema.sql` — tenants, users, api_keys, usage_events, audit_logs (RLS via `current_setting('app.current_tenant_id')`)
- `services/auth/src/db/migrations/002_dashboard_schema.sql` — agents, call_logs, phone_numbers, billing_plans, billing_usage_summaries, materialized views
- `services/orchestrator/src/db/migrations/001_orchestrator_schema.sql` — conversations, conversation_messages
- `services/email/src/db/migrations/001_email_schema.sql` — email_accounts, emails, attachments
- `services/rag/db/migrations/001_rag_schema.sql` — documents, document_chunks (pgvector)

The root **monolithic Dockerfile** bundles all services with supervisord (`supervisord.conf`) for single-container deployment. Startup priority: auth(10) → api-gateway(20) → stt/tts/rag(30) → orchestrator(40) → email/webvoice(50).

## Service Dependency Graph

```
API Gateway → Auth, STT, TTS, RAG, Flowise, Orchestrator, Email
Orchestrator → Auth, STT, TTS, RAG, Flowise (via Postgres + Redis)
Email → Orchestrator (AI responses), Auth (via Postgres + Redis)
Webvoice → STT, TTS, Orchestrator (via Redis, no Postgres)
Dashboard → Auth (API), API Gateway (proxy)
STT, TTS, RAG → Redis (caching); RAG → Postgres (pgvector)
```

Webvoice is the only Node.js service without a direct Postgres dependency.

## Middleware Pipeline Order

**Auth service** (`services/auth/src/index.ts`):
`helmet → cors → body-parser → pinoHttp → request-timing → request-id → routes → notFoundHandler → errorHandler`

**API Gateway** (`services/api-gateway/src/index.ts`):
`active-connections-gauge → helmet → cors → body-parser(50mb) → request-id → pinoHttp → request-timing → routes → notFoundHandler → errorHandler`

Note: API Gateway uses a 50MB body limit to accommodate audio payloads.

## Authentication Flow

Dual-mode auth in `services/auth/src/middleware/auth.ts`:

1. **JWT path** (Bearer token): Extract → check Redis blacklist → verify signature → validate type=access → set `req.context = { tenant_id, user_id }`
2. **API Key path** (X-API-Key header): Parse `prefix_secretkey` format → DB lookup by key_prefix → check expiration → bcrypt verify → update last_used_at → set `req.context = { tenant_id, api_key_id, scopes }`
3. The `authenticate` middleware tries Bearer first, falls back to API key, throws `AuthenticationError` if neither present

## Error Handling

Error class hierarchy in `services/auth/src/middleware/errorHandler.ts`:
```
AppError (base)
├── ValidationError (400)
├── AuthenticationError (401)
├── AuthorizationError (403)
├── NotFoundError (404)
├── ConflictError (409)
└── RateLimitError (429)
```

The centralized error handler also catches `ZodError` → 400. All errors return `{ error: { code, message, details }, requestId }`.

## Circuit Breaker (API Gateway)

`services/api-gateway/src/services/proxyService.ts` — per-service circuit breakers:
- **CLOSED → OPEN**: after 5 consecutive failures (5xx, ECONNABORTED, ECONNREFUSED). 4xx errors do NOT trip the breaker.
- **OPEN → HALF_OPEN**: after 30s recovery timeout
- **HALF_OPEN → CLOSED**: after 3 consecutive successes

The proxy propagates `Authorization`, `X-API-Key`, `X-Request-ID`, and `X-Tenant-ID` headers to upstream services.

## Rate Limiting

Redis-based sliding window (`services/auth/src/middleware/rateLimiter.ts`):
- Key: `ratelimit:{tenant_id}:{minute_bucket}` with INCR + EXPIRE in MULTI
- Limits: free=60, pro=300, enterprise=1000 requests/minute
- **Fail-open policy**: on Redis error, allow the request
- Sets headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Health Endpoints

K8s probes use `/health/live` and `/health/ready` (with dependency checks). Docker Compose uses `/health`. All services implement all three.

## Request ID Propagation

Generated in middleware if `X-Request-ID` header is missing: `${Date.now()}-${random}`. Set on both request and response headers, included in all error responses and log entries.

## Database Helpers

`services/auth/src/db/postgres.ts`:
- `query(text, params)` — logs duration + row count
- `transaction(callback)` — auto BEGIN/COMMIT/ROLLBACK
- `checkConnection()` — health check via `SELECT 1`
- Pool config: max 20, idle timeout 30s, connection timeout 2s

`services/auth/src/db/redis.ts`:
- Singleton client with auto-reconnect
- Helpers: `incrementRateLimit`, `setSession`, `blacklistToken`, `isTokenBlacklisted`
- Uses MULTI transactions for atomic operations

## Voice Pipeline Contracts

**STT Response**: `{ text, language, confidence, latency_ms }`
**LLM Response**: `{ response, sources[], model, latency_ms }`
**TTS Response**: Binary audio stream + headers `X-Latency-ms`, `X-Persona-Used`
**RAG**: nomic-embed-text (768 dim), pgvector cosine similarity, threshold 0.75, top_k=5

## Common Commands

```bash
# Docker Compose
docker compose up -d                    # Start all services
docker compose up -d postgres redis     # Start data layer only
docker compose logs -f auth             # Follow service logs

# Node.js services (from services/<name>/)
npm run dev           # Dev with hot reload (tsx watch)
npm run build         # TypeScript compile (tsc)
npm run start         # Run compiled (node dist/index.js)
npm test              # Vitest
npm run test:watch    # Vitest watch mode
npm run test:coverage # Coverage report
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit

# Run a single test file
npx vitest run src/__tests__/authService.test.ts

# Python services (from services/<name>/)
uvicorn main:app --reload --host 0.0.0.0 --port 8001   # STT
uvicorn main:app --reload --host 0.0.0.0 --port 8002   # TTS
uvicorn main:app --reload --host 0.0.0.0 --port 8003   # RAG
pytest tests/                                            # Run tests
ruff check .                                             # Lint (used in CI)
mypy . --ignore-missing-imports                          # Type check (used in CI)

# Dashboard (from services/dashboard/)
npm run dev           # Vite dev server on port 5173
npm run build         # Production build
npm run preview       # Preview production build

# Kubernetes
kubectl apply -k k8s/base
kubectl get pods -n voice-saas

# Deployment scripts (in scripts/)
./scripts/bootstrap-cluster.sh    # K8s cluster init
./scripts/provision-secrets.sh    # Secret management
./scripts/run-migrations.sh       # Database migrations
./scripts/smoke-test.sh           # Post-deployment validation
```

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- **ci.yaml** — PR validation: path-based change detection, parallel lint/typecheck/test per service, K8s manifest validation
- **build-push.yaml** — Build + push to GHCR (ghcr.io), multi-platform, per-service change detection, monolithic image on version tags
- **deploy-staging.yaml** / **deploy-prod.yaml** — Environment deployments
- **ArgoCD** manifests in `k8s/argocd/` for GitOps

## Tech Stack (Non-Negotiable)

- **Node.js services**: Node 20 LTS, TypeScript (strict, NodeNext), Express, Zod, pino, prom-client
- **Python ML services**: Python 3.10+, FastAPI, Pydantic Settings, structlog, prometheus_client
- **Data**: PostgreSQL 16 + pgvector, Redis 7
- **Voice**: Faster Whisper Large v3 (STT), IndicF5 + Piper fallback (TTS), Claude via Flowise (LLM)
- **Infra**: Kubernetes (prod) / Docker Compose (dev), Prometheus + Grafana, GitHub Actions + ArgoCD

## Environment Variable Naming

Node.js services use unprefixed names: `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `LOG_LEVEL`.

Python services use service-prefixed names: `STT_HOST`, `STT_PORT`, `STT_WHISPER_MODEL`, `TTS_INDICF5_DEVICE`, `RAG_DATABASE_URL`, `RAG_EMBEDDING_MODEL`. This avoids collisions in the monolithic single-container deployment.

Each service has a `.env.example` template.

## WebSocket Protocol (Webvoice)

Socket.IO events in `services/webvoice/src/sockets/voiceSocket.ts`:
- **Client → Server**: `start-session` (with optional language/persona_id), `audio-chunk` (binary), `end-session`
- **Server → Client**: `session-started`, `transcription`, `ai-response`, `audio-response` (binary), `session-timeout`, `error`
- Auth: Socket middleware validates JWT/API key before connection; sets `socket.authContext = { tenantId, userId, apiKeyId }`
- Sessions: Managed via Redis (`sessionManager.ts`), idle timeout configurable via `SESSION_TIMEOUT_SECONDS`

## Key Conventions

- **Multi-tenancy is mandatory**: every DB table has `tenant_id` with index, every query filters by `tenant_id`, upstream calls include `X-Tenant-ID` header. RLS policies enforce isolation at the DB level.
- **NodeNext module resolution**: `.js` extensions required in all TypeScript imports
- **Structured JSON logging only** — never console.log/print
- **Request context**: Express Request extended with `context` containing `tenant_id`, `user_id`, `api_key_id`, `scopes`. Defined via Zod in `types/index.ts` with `z.infer<>`.
- **Config validation**: Zod (Node) / Pydantic Settings (Python) on startup — exits immediately if invalid
- **Graceful shutdown**: All services listen for SIGTERM/SIGINT, close DB pool and Redis before exit
- **Docker**: Non-root user UID 1001, multi-stage builds for all services
- **Twilio webhook auth**: HMAC-SHA1 with `crypto.timingSafeEqual()` in `services/api-gateway/src/middleware/twilioAuth.ts`

## Monitoring

- `monitoring/prometheus.yml` — Scrape config for all 8 services + Flowise + data layer exporters
- `monitoring/alerting/alert-rules.yaml` — Prometheus alert rules
- `monitoring/grafana/dashboards/voice-pipeline-overview.json` — Voice pipeline Grafana dashboard
- Grafana datasources auto-provisioned from `monitoring/grafana/datasources/`

## Key Documentation

- `linkedeye-voice-agent/CLAUDE.md` — Architecture diagram and technical requirements
- `linkedeye-voice-agent/.claude/agents/voice-saas-architect.md` — Implementation agent with full context (use via Task tool)
- `Documents/LinkedEye-Folder-Structure.md` — Target directory structure (~285 files)
- `Documents/VoiceAgent-SaaS-Product-Vision.md` — Product roadmap
- `Santhira-voice-agent/` — Alternative voice agent implementation (Python, OpenAI-based)

## GPU Configuration

Uncomment GPU sections in `docker-compose.yml` and set:
```bash
STT_WHISPER_DEVICE=cuda  STT_WHISPER_COMPUTE_TYPE=float16
TTS_INDICF5_DEVICE=cuda  TTS_INDICF5_ENABLED=true
```

## K8s Namespaces

`voice-saas` (app), `data` (PostgreSQL/Redis), `monitoring` (Prometheus/Grafana), `ingress` (nginx)

K8s deployments use: 2 replicas, pod anti-affinity, non-root security context (UID 1001), read-only root filesystem, and HPA with Kustomize overlays in `k8s/base/`.
