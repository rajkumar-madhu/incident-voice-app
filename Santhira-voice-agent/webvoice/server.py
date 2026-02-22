"""FastAPI + Socket.IO ASGI application for Santhira web voice interface."""

from __future__ import annotations

from pathlib import Path

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from webvoice.socket_handler import register_handlers

# Socket.IO async server
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

# FastAPI app with health endpoint
api = FastAPI(title="Santhira Web Voice", docs_url=None, redoc_url=None)

# CORS — allow any origin to load widget.js and hit /embed
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

static_dir = Path(__file__).parent / "static"


@api.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "santhira-webvoice"}


@api.get("/")
async def index() -> FileResponse:
    return FileResponse(str(static_dir / "index.html"))


@api.get("/embed", response_class=HTMLResponse)
async def embed_demo() -> str:
    """Demo page showing the embeddable widget on a sample host page."""
    return """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Santhira Widget — Embed Demo</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    max-width: 720px; margin: 60px auto; padding: 0 24px;
    color: #333; line-height: 1.7;
  }
  h1 { color: #6366f1; }
  pre {
    background: #f4f4f5; padding: 16px; border-radius: 8px;
    overflow-x: auto; font-size: 13px;
  }
  code { color: #6366f1; }
</style>
</head>
<body>
<h1>Santhira Voice Agent — Widget Demo</h1>
<p>This page demonstrates the embeddable widget. Look for the purple chat
   button in the bottom-right corner.</p>
<h2>Embed Snippet</h2>
<pre>&lt;script src="https://voice.santhira.com/static/widget.js"
        data-server="https://voice.santhira.com"&gt;&lt;/script&gt;</pre>
<h2>Optional Attributes</h2>
<ul>
  <li><code>data-theme="light|dark"</code> — colour scheme (default: dark)</li>
  <li><code>data-position="bottom-right|bottom-left"</code></li>
  <li><code>data-accent-color="#6366f1"</code></li>
  <li><code>data-greeting="Custom greeting"</code></li>
</ul>

<script src="/static/widget.js" data-server=""></script>
</body>
</html>
"""


# Mount static assets
api.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Wrap FastAPI with Socket.IO ASGI app
app = socketio.ASGIApp(sio, other_asgi_app=api)

# Register socket event handlers
register_handlers(sio)
