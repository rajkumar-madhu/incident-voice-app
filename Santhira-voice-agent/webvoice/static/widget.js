/**
 * Santhira Voice Agent — Embeddable Widget
 *
 * Usage:
 *   <script src="https://voice.santhira.com/static/widget.js"
 *           data-server="https://voice.santhira.com"></script>
 *
 * Optional attributes:
 *   data-theme="light|dark"        (default: dark)
 *   data-position="bottom-right|bottom-left"  (default: bottom-right)
 *   data-accent-color="#6366f1"    (default: #6366f1)
 *   data-greeting="Custom greeting message"
 */
(function () {
  "use strict";

  // ── Double-init guard ────────────────────────────────────
  if (window.__santhiraWidgetLoaded) return;
  window.__santhiraWidgetLoaded = true;

  // ── Read config from script tag ──────────────────────────
  var scriptEl =
    document.currentScript ||
    document.querySelector('script[data-server][src*="widget"]');

  var SERVER = (scriptEl && scriptEl.getAttribute("data-server")) || "";
  var THEME = (scriptEl && scriptEl.getAttribute("data-theme")) || "dark";
  var POSITION =
    (scriptEl && scriptEl.getAttribute("data-position")) || "bottom-right";
  var ACCENT =
    (scriptEl && scriptEl.getAttribute("data-accent-color")) || "#6366f1";
  var GREETING =
    (scriptEl && scriptEl.getAttribute("data-greeting")) ||
    "Hello! I\u2019m Santhira, your IT assistant. How can I help you today?";

  var isLight = THEME === "light";
  var isLeft = POSITION === "bottom-left";

  // ── Inject Socket.IO client (idempotent) ─────────────────
  function loadSocketIO(cb) {
    if (window.io) return cb();
    var s = document.createElement("script");
    s.src = "https://cdn.socket.io/4.7.5/socket.io.min.js";
    s.onload = cb;
    s.onerror = function () {
      console.error("[Santhira Widget] Failed to load Socket.IO");
    };
    document.head.appendChild(s);
  }

  // ── CSS ──────────────────────────────────────────────────
  var CSS = /* css */ '\
:host {\
  --sw-bg: ' + (isLight ? "#ffffff" : "#0f1117") + ';\
  --sw-surface: ' + (isLight ? "#f4f4f5" : "#1a1d27") + ';\
  --sw-border: ' + (isLight ? "#e4e4e7" : "#2a2d3a") + ';\
  --sw-text: ' + (isLight ? "#18181b" : "#e4e4e7") + ';\
  --sw-muted: ' + (isLight ? "#71717a" : "#71717a") + ';\
  --sw-accent: ' + ACCENT + ';\
  --sw-accent-hover: ' + (isLight ? "#4f46e5" : "#818cf8") + ';\
  --sw-red: #ef4444;\
  --sw-green: #22c55e;\
  all: initial;\
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\
  font-size: 14px;\
  color: var(--sw-text);\
  line-height: 1.5;\
}\
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\
\
/* FAB */\
.sw-fab {\
  position: fixed;\
  ' + (isLeft ? "left" : "right") + ': 24px;\
  bottom: 24px;\
  width: 60px;\
  height: 60px;\
  border-radius: 50%;\
  background: var(--sw-accent);\
  color: #fff;\
  border: none;\
  cursor: pointer;\
  box-shadow: 0 4px 14px rgba(0,0,0,0.25);\
  z-index: 2147483646;\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  transition: transform 0.2s, background 0.2s;\
}\
.sw-fab:hover { transform: scale(1.08); background: var(--sw-accent-hover); }\
.sw-fab svg { width: 28px; height: 28px; fill: currentColor; }\
\
/* Panel */\
.sw-panel {\
  position: fixed;\
  ' + (isLeft ? "left" : "right") + ': 24px;\
  bottom: 96px;\
  width: 380px;\
  max-width: calc(100vw - 48px);\
  height: 520px;\
  max-height: calc(100vh - 120px);\
  background: var(--sw-bg);\
  border: 1px solid var(--sw-border);\
  border-radius: 16px;\
  box-shadow: 0 8px 30px rgba(0,0,0,0.3);\
  z-index: 2147483646;\
  display: none;\
  flex-direction: column;\
  overflow: hidden;\
}\
.sw-panel.open { display: flex; }\
\
/* Header */\
.sw-header {\
  padding: 14px 16px;\
  border-bottom: 1px solid var(--sw-border);\
  display: flex;\
  align-items: center;\
  gap: 10px;\
  flex-shrink: 0;\
}\
.sw-header-title {\
  font-size: 15px;\
  font-weight: 600;\
  flex: 1;\
}\
.sw-status {\
  font-size: 11px;\
  padding: 3px 8px;\
  border-radius: 10px;\
  background: var(--sw-surface);\
  color: var(--sw-muted);\
}\
.sw-status.connected { background: #052e16; color: var(--sw-green); }\
.sw-close {\
  background: none;\
  border: none;\
  color: var(--sw-muted);\
  cursor: pointer;\
  font-size: 20px;\
  line-height: 1;\
  padding: 0 4px;\
}\
.sw-close:hover { color: var(--sw-text); }\
\
/* Messages */\
.sw-messages {\
  flex: 1;\
  overflow-y: auto;\
  padding: 16px;\
  display: flex;\
  flex-direction: column;\
  gap: 12px;\
}\
.sw-messages::-webkit-scrollbar { width: 5px; }\
.sw-messages::-webkit-scrollbar-track { background: transparent; }\
.sw-messages::-webkit-scrollbar-thumb { background: var(--sw-border); border-radius: 3px; }\
\
.sw-msg {\
  max-width: 80%;\
  padding: 10px 14px;\
  border-radius: 12px;\
  font-size: 13px;\
  line-height: 1.5;\
  white-space: pre-wrap;\
  word-break: break-word;\
}\
.sw-msg.user {\
  align-self: flex-end;\
  background: var(--sw-accent);\
  color: #fff;\
  border-bottom-right-radius: 4px;\
}\
.sw-msg.assistant {\
  align-self: flex-start;\
  background: var(--sw-surface);\
  border: 1px solid var(--sw-border);\
  border-bottom-left-radius: 4px;\
}\
.sw-msg.processing {\
  align-self: center;\
  background: transparent;\
  color: var(--sw-muted);\
  font-style: italic;\
  padding: 6px;\
  border: none;\
}\
.sw-msg .sw-label {\
  font-size: 10px;\
  color: var(--sw-muted);\
  margin-bottom: 3px;\
  font-weight: 600;\
  text-transform: uppercase;\
  letter-spacing: 0.5px;\
}\
.sw-msg.user .sw-label { color: rgba(255,255,255,0.7); }\
\
/* Input bar */\
.sw-input-bar {\
  padding: 12px;\
  border-top: 1px solid var(--sw-border);\
  display: flex;\
  gap: 8px;\
  align-items: center;\
  flex-shrink: 0;\
}\
.sw-text-input {\
  flex: 1;\
  padding: 8px 12px;\
  border: 1px solid var(--sw-border);\
  border-radius: 8px;\
  background: var(--sw-surface);\
  color: var(--sw-text);\
  font-size: 13px;\
  font-family: inherit;\
  outline: none;\
  resize: none;\
}\
.sw-text-input::placeholder { color: var(--sw-muted); }\
.sw-text-input:focus { border-color: var(--sw-accent); }\
\
.sw-btn {\
  width: 36px;\
  height: 36px;\
  border-radius: 50%;\
  border: none;\
  cursor: pointer;\
  display: flex;\
  align-items: center;\
  justify-content: center;\
  transition: background 0.2s, transform 0.15s;\
  flex-shrink: 0;\
}\
.sw-send-btn {\
  background: var(--sw-accent);\
  color: #fff;\
}\
.sw-send-btn:hover { background: var(--sw-accent-hover); }\
.sw-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }\
.sw-send-btn svg { width: 16px; height: 16px; fill: currentColor; }\
\
.sw-mic-btn {\
  background: var(--sw-surface);\
  border: 1px solid var(--sw-border);\
  color: var(--sw-text);\
}\
.sw-mic-btn:hover { border-color: var(--sw-accent); color: var(--sw-accent); }\
.sw-mic-btn.recording {\
  background: var(--sw-red);\
  border-color: var(--sw-red);\
  color: #fff;\
  animation: sw-pulse 1.5s infinite;\
}\
.sw-mic-btn svg { width: 16px; height: 16px; fill: currentColor; }\
\
@keyframes sw-pulse {\
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }\
  50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }\
}\
';

  // ── HTML (template) ──────────────────────────────────────
  var HTML = '\
<button class="sw-fab" aria-label="Open Santhira Voice Agent">\
  <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>\
</button>\
<div class="sw-panel">\
  <div class="sw-header">\
    <span class="sw-header-title">Santhira</span>\
    <span class="sw-status">Disconnected</span>\
    <button class="sw-close" aria-label="Close">&times;</button>\
  </div>\
  <div class="sw-messages">\
    <div class="sw-msg assistant">\
      <div class="sw-label">Santhira</div>\
      ' + GREETING.replace(/</g, "&lt;") + '\
    </div>\
  </div>\
  <div class="sw-input-bar">\
    <input class="sw-text-input" placeholder="Type a message\u2026" />\
    <button class="sw-send-btn" disabled aria-label="Send">\
      <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>\
    </button>\
    <button class="sw-mic-btn" disabled aria-label="Record voice">\
      <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>\
    </button>\
  </div>\
</div>\
';

  // ── Build Shadow DOM ────────────────────────────────────
  var host = document.createElement("div");
  host.id = "santhira-widget-host";
  var shadow = host.attachShadow({ mode: "closed" });

  var style = document.createElement("style");
  style.textContent = CSS;
  shadow.appendChild(style);

  var container = document.createElement("div");
  container.innerHTML = HTML;
  shadow.appendChild(container);

  document.body.appendChild(host);

  // ── Element refs ─────────────────────────────────────────
  var fab = shadow.querySelector(".sw-fab");
  var panel = shadow.querySelector(".sw-panel");
  var closeBtn = shadow.querySelector(".sw-close");
  var statusEl = shadow.querySelector(".sw-status");
  var messagesEl = shadow.querySelector(".sw-messages");
  var textInput = shadow.querySelector(".sw-text-input");
  var sendBtn = shadow.querySelector(".sw-send-btn");
  var micBtn = shadow.querySelector(".sw-mic-btn");

  // ── State ────────────────────────────────────────────────
  var socket = null;
  var sessionReady = false;
  var mediaRecorder = null;
  var recording = false;
  var panelOpen = false;
  var audioQueue = [];
  var isPlaying = false;

  // ── FAB toggle ───────────────────────────────────────────
  fab.addEventListener("click", function () {
    panelOpen = !panelOpen;
    panel.classList.toggle("open", panelOpen);
    if (panelOpen) {
      connectIfNeeded();
      textInput.focus();
    }
  });

  closeBtn.addEventListener("click", function () {
    panelOpen = false;
    panel.classList.remove("open");
  });

  // ── Lazy Socket.IO connection ────────────────────────────
  function connectIfNeeded() {
    if (socket) return;
    loadSocketIO(function () {
      socket = io(SERVER, {
        transports: ["websocket", "polling"],
        withCredentials: true,
      });

      socket.on("connect", function () {
        statusEl.textContent = "Connected";
        statusEl.classList.add("connected");
        sendBtn.disabled = false;
        micBtn.disabled = false;
        socket.emit("start-session", {});
      });

      socket.on("disconnect", function () {
        statusEl.textContent = "Disconnected";
        statusEl.classList.remove("connected");
        sendBtn.disabled = true;
        micBtn.disabled = true;
        sessionReady = false;
      });

      socket.on("session-ready", function () {
        sessionReady = true;
      });

      socket.on("transcript", function (data) {
        removeProcessing();
        addMessage("user", data.text);
        addProcessing("Thinking\u2026");
      });

      socket.on("response-text", function (data) {
        removeProcessing();
        addMessage("assistant", data.text);
      });

      socket.on("audio-response", function (data) {
        enqueueAudio(data.audio);
      });

      socket.on("audio-done", function () {
        /* playback continues from queue */
      });

      socket.on("error", function (data) {
        removeProcessing();
        if (data.code !== "AUDIO_TOO_SHORT") {
          addMessage("assistant", "Error: " + data.message);
        }
      });
    });
  }

  // ── Text input ───────────────────────────────────────────
  textInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  });

  sendBtn.addEventListener("click", function () {
    sendTextMessage();
  });

  function sendTextMessage() {
    var text = textInput.value.trim();
    if (!text || !socket || !socket.connected) return;
    addMessage("user", text);
    addProcessing("Thinking\u2026");
    socket.emit("text-message", { text: text });
    textInput.value = "";
  }

  // ── Voice recording ──────────────────────────────────────
  micBtn.addEventListener("click", function () {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  function startRecording() {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        var mimeType = getMimeType();
        var opts = mimeType ? { mimeType: mimeType } : {};
        mediaRecorder = new MediaRecorder(stream, opts);

        mediaRecorder.ondataavailable = function (e) {
          if (e.data.size > 0 && socket && socket.connected) {
            socket.emit("audio-chunk", e.data);
          }
        };

        mediaRecorder.onstop = function () {
          stream.getTracks().forEach(function (t) {
            t.stop();
          });
          if (socket && socket.connected) {
            socket.emit("finalize-audio", {});
            addProcessing("Transcribing\u2026");
          }
        };

        mediaRecorder.start(250);
        recording = true;
        micBtn.classList.add("recording");
      })
      .catch(function () {
        addMessage(
          "assistant",
          "Microphone access denied. Please allow microphone permissions."
        );
      });
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    recording = false;
    micBtn.classList.remove("recording");
  }

  function getMimeType() {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    )
      return "audio/webm;codecs=opus";
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("audio/webm")
    )
      return "audio/webm";
    return "";
  }

  // ── Audio playback queue ─────────────────────────────────
  function enqueueAudio(base64mp3) {
    audioQueue.push(base64mp3);
    if (!isPlaying) playNext();
  }

  function playNext() {
    if (audioQueue.length === 0) {
      isPlaying = false;
      return;
    }
    isPlaying = true;
    var b64 = audioQueue.shift();
    try {
      var raw = atob(b64);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      var blob = new Blob([bytes], { type: "audio/mpeg" });
      var url = URL.createObjectURL(blob);
      var audio = new Audio(url);
      audio.onended = function () {
        URL.revokeObjectURL(url);
        playNext();
      };
      audio.onerror = function () {
        URL.revokeObjectURL(url);
        playNext();
      };
      audio.play().catch(function () {
        playNext();
      });
    } catch (e) {
      playNext();
    }
  }

  // ── Chat UI helpers ──────────────────────────────────────
  function addMessage(role, text) {
    var div = document.createElement("div");
    div.className = "sw-msg " + role;
    var label = document.createElement("div");
    label.className = "sw-label";
    label.textContent = role === "user" ? "You" : "Santhira";
    div.appendChild(label);
    div.appendChild(document.createTextNode(text));
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addProcessing(text) {
    removeProcessing();
    var div = document.createElement("div");
    div.className = "sw-msg processing";
    div.setAttribute("data-processing", "true");
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeProcessing() {
    var el = messagesEl.querySelector('[data-processing="true"]');
    if (el) el.remove();
  }
})();
