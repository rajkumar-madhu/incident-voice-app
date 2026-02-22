# Santhira Voice Agent — Embeddable Widget Integration Guide

**Document Version:** 1.0
**Date:** 2026-02-23
**Classification:** Enterprise — Confidential
**Author:** LinkedEye Engineering
**Approver:** Product & Engineering Lead

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Quick Start Integration](#3-quick-start-integration)
4. [Configuration Reference](#4-configuration-reference)
5. [Widget Features](#5-widget-features)
6. [Socket.IO Event Protocol](#6-socketio-event-protocol)
7. [Security & Compliance](#7-security--compliance)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Cross-Origin & Cookie Policy](#9-cross-origin--cookie-policy)
10. [Platform Integration Guides](#10-platform-integration-guides)
11. [Performance & Scalability](#11-performance--scalability)
12. [Monitoring & Observability](#12-monitoring--observability)
13. [Troubleshooting](#13-troubleshooting)
14. [API & Endpoint Reference](#14-api--endpoint-reference)
15. [Browser Compatibility](#15-browser-compatibility)
16. [Change Log](#16-change-log)

---

## 1. Executive Summary

The Santhira Voice Agent Embeddable Widget enables enterprises to integrate an AI-powered IT incident management assistant into any web application with a single `<script>` tag. The widget provides both **text** and **voice** interaction channels, backed by a real-time pipeline: Speech-to-Text (OpenAI Whisper) → LLM (GPT-4.1 with function calling) → Text-to-Speech (OpenAI TTS), with ITSM integration and RAG-powered runbook search.

### Key Capabilities

| Capability | Description |
|------------|-------------|
| **Text Chat** | Users type messages and receive AI-powered responses in real time |
| **Voice Input** | Browser-based microphone recording with Whisper STT transcription |
| **Voice Output** | Sentence-level TTS streaming with sequential audio playback |
| **ITSM Integration** | Incident lookup, creation, escalation, and history via function calling |
| **Runbook Search** | RAG-powered similarity search across operational runbooks |
| **Shadow DOM Isolation** | Zero CSS/JS conflicts with host applications |
| **Cross-Origin Support** | Embeddable on any domain with full CORS and cookie support |
| **Theme Customization** | Light/dark themes, configurable accent color, position, and greeting |

### Integration Effort

| Aspect | Detail |
|--------|--------|
| **Integration time** | < 5 minutes |
| **Lines of code** | 1 (single `<script>` tag) |
| **Dependencies** | None (Socket.IO loaded automatically from CDN) |
| **Authentication** | Session-based (API key auth planned for future release) |
| **Hosting** | Fully managed at `https://voice.santhira.com` |

---

## 2. Architecture Overview

### 2.1 High-Level Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  HOST APPLICATION (any website)                                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  <script src="https://voice.santhira.com/static/widget.js" │  │
│  │          data-server="https://voice.santhira.com">         │  │
│  └────────────────────────────────────────────────────────────┘  │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────┐                                         │
│  │  Shadow DOM Widget   │  ← CSS-isolated, no style leakage     │
│  │  ┌───────────────┐  │                                         │
│  │  │ Chat Panel     │  │                                         │
│  │  │ Text Input     │  │                                         │
│  │  │ Mic Button     │  │                                         │
│  │  │ Audio Playback │  │                                         │
│  │  └───────────────┘  │                                         │
│  └─────────┬───────────┘                                         │
└────────────┼─────────────────────────────────────────────────────┘
             │ WebSocket (Socket.IO)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│  SANTHIRA BACKEND (voice.santhira.com)                          │
│                                                                  │
│  ┌──────────────┐    ┌───────────┐    ┌───────────────────────┐ │
│  │  Socket.IO    │───▶│   STT     │───▶│   LLM (GPT-4.1)      │ │
│  │  Server       │    │  Whisper  │    │   + Function Calling  │ │
│  │  (FastAPI)    │    └───────────┘    │   + ITSM Tools        │ │
│  │               │                     │   + RAG Search        │ │
│  │               │◀───────────────────│                       │ │
│  │               │    ┌───────────┐    └───────────────────────┘ │
│  │               │───▶│   TTS     │                              │
│  │               │◀──│  OpenAI   │                              │
│  └──────────────┘    └───────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Voice Pipeline Sequence

```
Text Path:
  User types message
    → text-message event via Socket.IO
    → GPT-4.1 agent loop (max 5 tool rounds)
    → response-text event (AI response)
    → TTS synthesis (sentence-by-sentence)
    → audio-response events (base64 MP3 chunks)
    → audio-done event

Voice Path:
  User clicks mic → MediaRecorder starts
    → audio-chunk events (250ms WebM/Opus chunks)
  User clicks mic again → MediaRecorder stops
    → finalize-audio event
    → Whisper STT transcription
    → transcript event (transcribed text)
    → GPT-4.1 agent loop (same as text path)
    → response-text + audio-response + audio-done events
```

### 2.3 Component Responsibilities

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Widget (client) | Vanilla JS, Shadow DOM | UI, recording, playback, Socket.IO transport |
| Socket.IO Server | Python, FastAPI, python-socketio | Session management, event routing |
| STT | OpenAI Whisper API | Audio transcription (WebM/Opus → text) |
| LLM | GPT-4.1 + function calling | Reasoning, ITSM tool invocation, response generation |
| TTS | OpenAI TTS API | Text-to-speech synthesis (sentence-level streaming) |
| ITSM Backend | REST API | Incident CRUD, escalation, history |
| RAG Service | pgvector + nomic-embed-text | Runbook similarity search (cosine, threshold 0.75) |

---

## 3. Quick Start Integration

### 3.1 Minimal Embed (One Line)

Add this before `</body>` in your HTML:

```html
<script src="https://voice.santhira.com/static/widget.js"
        data-server="https://voice.santhira.com"></script>
```

Result: A purple floating chat button appears in the bottom-right corner. Clicking it opens the voice + text chat panel.

### 3.2 Customized Embed

```html
<script src="https://voice.santhira.com/static/widget.js"
        data-server="https://voice.santhira.com"
        data-theme="light"
        data-position="bottom-left"
        data-accent-color="#0ea5e9"
        data-greeting="Welcome! I'm your IT assistant. How can I help?"></script>
```

### 3.3 Verification Checklist

After embedding, verify:

- [ ] Purple (or custom color) floating button visible in the configured corner
- [ ] Clicking button opens chat panel with greeting message
- [ ] Status indicator shows "Connected" (green badge)
- [ ] Typing a message and pressing Enter yields an AI response
- [ ] Audio plays automatically after the AI responds
- [ ] Mic button starts recording (red pulse animation)
- [ ] Stopping recording triggers transcription → AI response → audio
- [ ] No CSS conflicts with host page (Shadow DOM isolation)
- [ ] Browser console (F12) shows no errors

---

## 4. Configuration Reference

### 4.1 Script Attributes

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `src` | URL | Yes | — | Widget script URL: `https://voice.santhira.com/static/widget.js` |
| `data-server` | URL | Yes | — | Santhira backend URL: `https://voice.santhira.com` |
| `data-theme` | String | No | `dark` | Color scheme: `light` or `dark` |
| `data-position` | String | No | `bottom-right` | Widget position: `bottom-right` or `bottom-left` |
| `data-accent-color` | Hex Color | No | `#6366f1` | Primary accent color for buttons and user messages |
| `data-greeting` | String | No | *See below* | Initial greeting message displayed in chat |

**Default greeting:** *"Hello! I'm Santhira, your IT assistant. How can I help you today?"*

### 4.2 Theme Color Palettes

**Dark Theme (default)**

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0f1117` | Panel background |
| Surface | `#1a1d27` | Input fields, assistant messages |
| Border | `#2a2d3a` | Panel border, input borders |
| Text | `#e4e4e7` | Primary text |
| Muted | `#71717a` | Labels, status text |
| Accent | Configurable | Buttons, user messages |

**Light Theme**

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#ffffff` | Panel background |
| Surface | `#f4f4f5` | Input fields, assistant messages |
| Border | `#e4e4e7` | Panel border, input borders |
| Text | `#18181b` | Primary text |
| Muted | `#71717a` | Labels, status text |
| Accent | Configurable | Buttons, user messages |

### 4.3 Widget Dimensions

| Property | Value |
|----------|-------|
| FAB (Floating Action Button) | 60 x 60px, circular |
| Chat panel width | 380px (max: `calc(100vw - 48px)`) |
| Chat panel height | 520px (max: `calc(100vh - 120px)`) |
| Panel border radius | 16px |
| Z-index | 2147483646 (near-maximum, below browser UI) |

---

## 5. Widget Features

### 5.1 Shadow DOM Isolation

The widget renders inside a **closed Shadow DOM**, ensuring:

- **No CSS leakage inward:** Host page styles do not affect widget appearance
- **No CSS leakage outward:** Widget styles do not affect host page elements
- **No ID/class collisions:** Widget elements are invisible to `document.querySelector()` on the host page
- **Closed mode:** The shadow root is not accessible via `element.shadowRoot`, providing encapsulation

### 5.2 Lazy Loading

Socket.IO client library (CDN: `cdn.socket.io/4.7.5/socket.io.min.js`) is **not loaded on page load**. It is fetched only when the user opens the widget for the first time. This ensures:

- Zero impact on host page load time
- No unnecessary network requests if widget is never opened
- Socket.IO connection established only when needed

### 5.3 Double-Init Guard

The widget sets `window.__santhiraWidgetLoaded = true` on first execution. Subsequent script inclusions are silently ignored. Safe for:

- Single Page Applications (SPA) with dynamic script injection
- CMS platforms that may include the snippet multiple times
- Tag managers that fire on multiple page events

### 5.4 Audio Playback Queue

TTS responses are streamed sentence-by-sentence. The widget maintains an internal queue:

1. Each `audio-response` event appends a base64 MP3 chunk to the queue
2. Playback proceeds sequentially — next chunk plays after current finishes
3. Handles decode errors gracefully (skips to next chunk)
4. Uses `URL.createObjectURL()` + `<audio>` element for broad compatibility

### 5.5 Voice Recording

- **API:** MediaRecorder (Web standard)
- **Format:** WebM/Opus (preferred), WebM (fallback)
- **Chunk interval:** 250ms (streamed in real-time)
- **Permission:** Browser prompts on first mic access; subsequent sessions reuse grant
- **Visual feedback:** Mic button turns red with pulse animation during recording

---

## 6. Socket.IO Event Protocol

### 6.1 Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `start-session` | `{}` | Initialize a new conversation session. Sent automatically on connect. |
| `text-message` | `{ text: string }` | Send a text message to the AI agent. |
| `audio-chunk` | `Blob (binary)` | Stream a 250ms audio recording chunk. |
| `finalize-audio` | `{}` | Signal end of recording; triggers STT → LLM → TTS pipeline. |
| `end-session` | `{}` | Explicitly end the session and clean up server resources. |

### 6.2 Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `session-ready` | `{ session_id: string }` | Session initialized, ready for interaction. |
| `transcript` | `{ text: string }` | STT transcription result (voice input only). |
| `response-text` | `{ text: string }` | AI agent's text response. |
| `audio-response` | `{ audio: string, chunk: number }` | Base64-encoded MP3 audio chunk. `chunk` is 0-indexed. |
| `audio-done` | `{}` | All audio chunks for this response have been sent. |
| `error` | `{ code: string, message: string }` | Error occurred. See error codes below. |

### 6.3 Error Codes

| Code | HTTP Equiv | Description | Widget Behavior |
|------|-----------|-------------|-----------------|
| `NO_SESSION` | 400 | `start-session` was not called before sending data | Displays error in chat |
| `AUDIO_TOO_SHORT` | 400 | Recording was < 1KB (likely accidental) | Silently ignored |
| `PIPELINE_ERROR` | 500 | STT, LLM, or TTS failure | Displays error in chat |

### 6.4 Connection Lifecycle

```
1. Widget opens → loadSocketIO() from CDN
2. io(SERVER, { transports: ["websocket", "polling"], withCredentials: true })
3. on("connect") → emit("start-session")
4. on("session-ready") → session active, UI enabled
5. User interacts → text-message / audio-chunk / finalize-audio
6. Server responds → response-text + audio-response + audio-done
7. Widget closes → connection maintained (lazy disconnect on page unload)
8. on("disconnect") → UI disabled, auto-reconnect by Socket.IO
```

---

## 7. Security & Compliance

### 7.1 Transport Security

| Layer | Mechanism |
|-------|-----------|
| **TLS** | All connections use HTTPS/WSS (TLS 1.2+). HTTP is redirected to HTTPS via ingress. |
| **Certificate** | Let's Encrypt (auto-renewed via cert-manager) |
| **WebSocket Upgrade** | Secured over the same TLS connection |
| **CORS** | `Access-Control-Allow-Origin: *` for GET requests (widget.js, /embed). Socket.IO CORS also allows all origins. |

### 7.2 Session Security

| Property | Detail |
|----------|--------|
| **Session storage** | Server-side, in-memory (ephemeral, no persistence) |
| **Session cookie** | `VOICESESSION` — `Secure; HttpOnly; SameSite=None` |
| **Sticky sessions** | NGINX ingress affinity cookie for Socket.IO routing |
| **Session timeout** | 1800 seconds (30 minutes), configurable |
| **Session cleanup** | Automatic on disconnect or explicit `end-session` event |

### 7.3 Data Handling

| Data Type | Handling |
|-----------|----------|
| **Audio recordings** | Streamed in real-time, buffered in memory only during processing, not persisted |
| **Conversation history** | In-memory per session, destroyed on disconnect |
| **Transcriptions** | Processed by OpenAI Whisper API, subject to OpenAI data policies |
| **AI responses** | Generated by GPT-4.1, subject to OpenAI data policies |
| **ITSM data** | Fetched on-demand from ITSM backend, not cached in widget |

### 7.4 Content Security Policy (CSP) Considerations

If the host application enforces a Content Security Policy, the following directives must allow:

```
script-src: https://voice.santhira.com https://cdn.socket.io
connect-src: wss://voice.santhira.com https://voice.santhira.com
media-src: blob:
```

**Recommended CSP additions:**

```html
<meta http-equiv="Content-Security-Policy" content="
  script-src 'self' https://voice.santhira.com https://cdn.socket.io;
  connect-src 'self' wss://voice.santhira.com https://voice.santhira.com;
  media-src 'self' blob:;
">
```

### 7.5 Permissions Policy

The widget requires the `microphone` permission for voice input. If the host page restricts permissions:

```html
<iframe allow="microphone" ...>  <!-- If loading in iframe -->
```

Or via HTTP header:
```
Permissions-Policy: microphone=(self "https://voice.santhira.com")
```

### 7.6 Future: API Key Authentication

A future release will support authenticated widget connections via `data-api-key`:

```html
<script src="https://voice.santhira.com/static/widget.js"
        data-server="https://voice.santhira.com"
        data-api-key="prefix_sk_live_..."></script>
```

This will enable:
- Per-tenant isolation and usage tracking
- Rate limiting per API key
- Scope-based access control
- Usage analytics and billing

---

## 8. Deployment Architecture

### 8.1 Infrastructure Overview

```
┌─────────────────────────────────────────────────────────┐
│  DigitalOcean Kubernetes Cluster                        │
│  Namespace: voice-saas                                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  NGINX Ingress Controller                        │    │
│  │  voice.santhira.com → santhira-frontend:5000     │    │
│  │  TLS: Let's Encrypt (cert-manager)               │    │
│  │  Sticky sessions: VOICESESSION cookie            │    │
│  │  WebSocket timeout: 3600s                        │    │
│  └────────────────────┬────────────────────────────┘    │
│                       ▼                                  │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Deployment: santhira-frontend                   │    │
│  │  Image: registry.gitlab.com/.../frontend:latest  │    │
│  │  Port: 5000                                      │    │
│  │  Replicas: 1                                     │    │
│  │                                                   │    │
│  │  ConfigMap Mounts:                               │    │
│  │  ├── frontend-static-fix    → /app/.../index.html│    │
│  │  ├── frontend-socket-handler→ /app/.../socket_handler.py │
│  │  ├── frontend-server-py     → /app/.../server.py │    │
│  │  └── frontend-widget-js     → /app/.../widget.js │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 8.2 ConfigMap Inventory

| ConfigMap | File | Purpose |
|-----------|------|---------|
| `frontend-widget-js` | `widget.js` | Embeddable widget script |
| `frontend-server-py` | `server.py` | FastAPI app with CORS + `/embed` endpoint |
| `frontend-socket-handler` | `socket_handler.py` | Socket.IO event handlers including `text-message` |
| `frontend-static-fix` | `index.html` | Full-page voice agent UI |
| `santhira-frontend-config` | Various | Application configuration and secrets |

### 8.3 Ingress Configuration

```yaml
# Key annotations for widget support
nginx.ingress.kubernetes.io/affinity: "cookie"
nginx.ingress.kubernetes.io/session-cookie-name: "VOICESESSION"
nginx.ingress.kubernetes.io/session-cookie-secure: "true"
nginx.ingress.kubernetes.io/session-cookie-samesite: "None"     # Cross-origin
nginx.ingress.kubernetes.io/session-cookie-expires: "1800"
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"          # 1h for voice
nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-body-size: "50m"              # Audio uploads
```

### 8.4 Update Procedure

To update the widget without redeploying the container:

```bash
# 1. Update ConfigMap
kubectl create configmap frontend-widget-js \
  --from-file=widget.js=<path-to-updated-widget.js> \
  -n voice-saas --dry-run=client -o yaml | kubectl apply -f -

# 2. Restart to pick up changes
kubectl rollout restart deployment santhira-frontend -n voice-saas

# 3. Verify rollout
kubectl rollout status deployment santhira-frontend -n voice-saas --timeout=120s

# 4. Smoke test
curl -s -o /dev/null -w "%{http_code}" https://voice.santhira.com/static/widget.js
# Expected: 200
```

---

## 9. Cross-Origin & Cookie Policy

### 9.1 Why Cross-Origin Matters

When the widget is embedded on `https://example.com`, it connects to `https://voice.santhira.com`. This is a cross-origin request. The following mechanisms enable this:

| Mechanism | Configuration | Purpose |
|-----------|---------------|---------|
| **CORS (FastAPI)** | `allow_origins=["*"]`, `allow_methods=["GET"]` | Allows `widget.js` and `/embed` to be loaded from any origin |
| **Socket.IO CORS** | `cors_allowed_origins="*"` | Allows WebSocket connections from any origin |
| **Cookie SameSite** | `SameSite=None; Secure` | Allows session cookie to be sent on cross-origin WebSocket |
| **Widget credentials** | `withCredentials: true` | Socket.IO sends cookies on cross-origin connections |

### 9.2 Cookie Flow

```
1. Browser on example.com loads widget.js from voice.santhira.com
2. Widget opens Socket.IO connection to voice.santhira.com
3. NGINX ingress sets VOICESESSION cookie (SameSite=None, Secure, HttpOnly)
4. Subsequent requests include the cookie → sticky session maintained
5. All traffic routed to same pod for session consistency
```

### 9.3 Third-Party Cookie Deprecation

Modern browsers are deprecating third-party cookies. Current mitigation:

- Socket.IO `withCredentials: true` + `SameSite=None; Secure` works in Chrome 120+, Firefox, Safari
- Future mitigation planned: API key-based session binding (no cookie dependency)
- Alternative: CHIPS (Cookies Having Independent Partitioned State) support can be added if needed

---

## 10. Platform Integration Guides

### 10.1 Static HTML / Vanilla JS

```html
<!DOCTYPE html>
<html>
<body>
  <!-- Your page content -->

  <script src="https://voice.santhira.com/static/widget.js"
          data-server="https://voice.santhira.com"></script>
</body>
</html>
```

### 10.2 React / Next.js

**Next.js (App Router — `layout.tsx`):**

```tsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src="https://voice.santhira.com/static/widget.js"
          data-server="https://voice.santhira.com"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
```

**React (CRA / Vite — `index.html`):**

```html
<body>
  <div id="root"></div>
  <script src="https://voice.santhira.com/static/widget.js"
          data-server="https://voice.santhira.com"></script>
</body>
```

### 10.3 Angular

Add to `src/index.html` before `</body>`:

```html
<script src="https://voice.santhira.com/static/widget.js"
        data-server="https://voice.santhira.com"></script>
```

Or dynamically in `app.component.ts`:

```typescript
ngOnInit() {
  const script = document.createElement('script');
  script.src = 'https://voice.santhira.com/static/widget.js';
  script.setAttribute('data-server', 'https://voice.santhira.com');
  document.body.appendChild(script);
}
```

### 10.4 Vue.js / Nuxt

**Nuxt 3 (`nuxt.config.ts`):**

```typescript
export default defineNuxtConfig({
  app: {
    head: {
      script: [
        {
          src: "https://voice.santhira.com/static/widget.js",
          "data-server": "https://voice.santhira.com",
          defer: true,
        },
      ],
    },
  },
});
```

### 10.5 WordPress

**Option A:** Add to theme's `footer.php` before `</body>`:

```php
<script src="https://voice.santhira.com/static/widget.js"
        data-server="https://voice.santhira.com"></script>
```

**Option B:** Use a "Custom HTML" block or widget in the WordPress editor.

**Option C:** Add via `functions.php`:

```php
function santhira_widget_script() {
    wp_enqueue_script(
        'santhira-widget',
        'https://voice.santhira.com/static/widget.js',
        array(),
        null,
        true
    );
}
add_action('wp_enqueue_scripts', 'santhira_widget_script');
```

### 10.6 Shopify

Add to `theme.liquid` before `</body>`:

```html
<script src="https://voice.santhira.com/static/widget.js"
        data-server="https://voice.santhira.com"></script>
```

### 10.7 Google Tag Manager

1. Create a new **Custom HTML** tag
2. Paste the script tag
3. Set trigger to **All Pages**
4. Publish the container

### 10.8 Iframe Embed (Fallback)

If script injection is not possible, use an iframe pointing to the embed page:

```html
<iframe src="https://voice.santhira.com/embed"
        style="position:fixed;bottom:0;right:0;width:400px;height:600px;border:none;z-index:999999"
        allow="microphone">
</iframe>
```

> **Note:** The `<script>` tag approach is strongly preferred. Iframe has limitations with audio autoplay policies and increases resource usage.

---

## 11. Performance & Scalability

### 11.1 Client-Side Performance

| Metric | Value | Notes |
|--------|-------|-------|
| **widget.js size** | ~17 KB (uncompressed) | No external CSS; styles embedded |
| **Socket.IO CDN** | ~48 KB (minified) | Loaded lazily on first widget open |
| **Initial page impact** | 0 network requests | Script parsed but Socket.IO deferred |
| **Time to interactive** | < 200ms after click | Socket.IO load + WebSocket connect |
| **Memory footprint** | < 5 MB | Shadow DOM + audio queue |

### 11.2 Server-Side Latency (Typical)

| Pipeline Stage | Latency | Notes |
|----------------|---------|-------|
| Socket.IO round-trip | 20-50ms | WebSocket, varies by network |
| STT (Whisper) | 1-3s | Depends on audio length |
| LLM (GPT-4.1) | 2-8s | Depends on tool calling rounds (max 5) |
| TTS (per sentence) | 0.5-1.5s | Streamed as available |
| **Total (text input)** | 3-10s | No STT step |
| **Total (voice input)** | 4-13s | Includes STT |

### 11.3 Scalability Considerations

| Concern | Current | Recommendation |
|---------|---------|----------------|
| Concurrent sessions | Single replica, ~50-100 concurrent | Scale replicas with HPA |
| Session storage | In-memory (per pod) | Sticky sessions ensure affinity |
| Audio buffer | In-memory | Capped by recording duration |
| WebSocket connections | Limited by pod resources | Scale horizontally with ingress affinity |

---

## 12. Monitoring & Observability

### 12.1 Health Endpoints

| Endpoint | Method | Response | Purpose |
|----------|--------|----------|---------|
| `GET /health` | GET | `{"status":"ok","service":"santhira-webvoice"}` | Liveness/readiness probe |

### 12.2 Server Logs

The backend uses **structlog** (JSON format). Key log events:

| Event | Fields | Trigger |
|-------|--------|---------|
| `ws_connect` | `sid` | New WebSocket connection |
| `session_started` | `sid`, `session_id` | `start-session` event |
| `session_ended` | `sid` | `end-session` event |
| `ws_disconnect` | `sid` | WebSocket disconnection |
| `pipeline_error` | `sid`, `error` | STT/LLM/TTS failure |
| `text_pipeline_error` | `sid`, `error` | Text message pipeline failure |

### 12.3 Client-Side Debugging

Open browser DevTools (F12):

| Tab | What to check |
|-----|---------------|
| **Console** | Socket.IO connection events, errors |
| **Network** | `widget.js` load, WebSocket frames |
| **Network → WS** | Socket.IO events (click WebSocket entry → Messages) |
| **Application → Cookies** | `VOICESESSION` cookie present with correct flags |
| **Elements** | `#santhira-widget-host` → `#shadow-root (closed)` |

---

## 13. Troubleshooting

### 13.1 Common Issues

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Widget button doesn't appear | Script blocked by CSP | Add `script-src https://voice.santhira.com` to CSP |
| Widget button doesn't appear | Script loaded before `<body>` exists | Move script to end of `<body>` or use `defer` |
| Status stays "Disconnected" | WebSocket blocked by corporate proxy/firewall | Ensure `wss://voice.santhira.com` is allowed |
| Status stays "Disconnected" | Socket.IO CDN blocked | Ensure `https://cdn.socket.io` is accessible |
| No audio playback | Browser autoplay policy | User must interact with widget before audio plays (click satisfies this) |
| No audio playback | `blob:` blocked by CSP | Add `media-src blob:` to CSP |
| Mic button not working | Microphone permission denied | User must grant microphone access |
| Mic button not working | Page served over HTTP | MediaRecorder requires HTTPS (or localhost) |
| "Error: PIPELINE_ERROR" | Backend STT/LLM/TTS failure | Check server logs: `kubectl logs deploy/santhira-frontend -n voice-saas` |
| Widget styles look broken | CSS leaking into Shadow DOM | Should not happen with closed Shadow DOM; report as bug |
| Multiple widgets appear | Script included more than once (before guard fires) | Ensure single `<script>` tag; guard should prevent this |
| Cross-origin cookie not sent | Browser blocking third-party cookies | Enable third-party cookies for voice.santhira.com or wait for API key auth |

### 13.2 Diagnostic Commands

```bash
# Check pod health
kubectl get pods -n voice-saas -l app=santhira-frontend

# View recent logs
kubectl logs deploy/santhira-frontend -n voice-saas --tail=100

# Test Socket.IO handshake
curl -s "https://voice.santhira.com/socket.io/?EIO=4&transport=polling"
# Expected: 0{"sid":"...","upgrades":["websocket"],...}

# Test widget.js serving
curl -s -o /dev/null -w "%{http_code}" https://voice.santhira.com/static/widget.js
# Expected: 200

# Test embed page
curl -s -o /dev/null -w "%{http_code}" https://voice.santhira.com/embed
# Expected: 200

# Check CORS headers
curl -sI https://voice.santhira.com/static/widget.js | grep -i access-control

# Check cookie attributes
curl -sI https://voice.santhira.com/static/widget.js | grep -i set-cookie
# Expected: SameSite=None; Secure; HttpOnly
```

---

## 14. API & Endpoint Reference

### 14.1 HTTP Endpoints

| Method | Path | Response | Description |
|--------|------|----------|-------------|
| `GET` | `/` | HTML | Full-page voice agent UI |
| `GET` | `/embed` | HTML | Embed demo page with widget |
| `GET` | `/static/widget.js` | JavaScript | Embeddable widget script |
| `GET` | `/health` | JSON | Health check (`{"status":"ok"}`) |
| `GET` | `/socket.io/...` | Socket.IO | Socket.IO polling transport |
| `WS` | `/socket.io/...` | Socket.IO | Socket.IO WebSocket transport |

### 14.2 CORS Configuration

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: *
```

Socket.IO additionally allows all origins for WebSocket upgrade.

---

## 15. Browser Compatibility

### 15.1 Supported Browsers

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 80+ | Full support |
| Firefox | 78+ | Full support |
| Safari | 14.1+ | Full support; may require user gesture for audio |
| Edge | 80+ | Chromium-based, full support |
| Opera | 67+ | Chromium-based, full support |

### 15.2 Required Web APIs

| API | Usage | Fallback |
|-----|-------|----------|
| Shadow DOM v1 | CSS isolation | None (required) |
| WebSocket | Real-time communication | Socket.IO falls back to HTTP polling |
| MediaRecorder | Voice recording | Voice input unavailable; text input works |
| AudioContext / `<audio>` | Audio playback | Text responses still displayed |
| `navigator.mediaDevices.getUserMedia` | Microphone access | Voice input unavailable |

### 15.3 Mobile Support

| Platform | Browser | Status |
|----------|---------|--------|
| iOS | Safari 14.5+ | Supported (audio autoplay requires user gesture) |
| iOS | Chrome for iOS | Supported (uses WebKit engine) |
| Android | Chrome 80+ | Full support |
| Android | Firefox 78+ | Full support |

---

## 16. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-23 | Initial release — text chat, voice input, TTS audio streaming, Shadow DOM isolation, dark/light themes, cross-origin support |

---

## Appendix A: Files Modified/Created

| Action | File | Description |
|--------|------|-------------|
| **Created** | `Santhira-voice-agent/webvoice/static/widget.js` | Embeddable widget (IIFE, Shadow DOM, ~320 lines) |
| **Modified** | `Santhira-voice-agent/webvoice/server.py` | Added CORSMiddleware + `GET /embed` demo endpoint |
| **Modified** | `Santhira-voice-agent/webvoice/socket_handler.py` | Added `text-message` Socket.IO event handler |
| **Modified** | `k8s/base/ingress/ingress-santhira.yaml` | Changed `SameSite=Strict` → `SameSite=None` |

## Appendix B: Kubernetes Resources

| Resource | Namespace | Purpose |
|----------|-----------|---------|
| `ConfigMap/frontend-widget-js` | voice-saas | widget.js content |
| `ConfigMap/frontend-server-py` | voice-saas | server.py with CORS + /embed |
| `ConfigMap/frontend-socket-handler` | voice-saas | socket_handler.py with text-message |
| `ConfigMap/frontend-static-fix` | voice-saas | index.html (full-page UI) |
| `Deployment/santhira-frontend` | voice-saas | Application pod |
| `Ingress/santhira-frontend-ingress` | voice-saas | TLS + sticky sessions + WebSocket |

## Appendix C: Pipeline Test Results (2026-02-23)

```
Socket.IO connected : PASS
Session started     : PASS
AI response text    : PASS — "I can help you manage IT incidents..."
Audio chunks        : 2 PASS (282KB + 47KB base64)
Audio done signal   : PASS
Errors              : None
OVERALL             : ALL PASS
```

---

*End of Document*
