/**
 * Finspot Voice Agent Embed
 *
 * Drop-in floating voice button for https://fs-le-dev-inc.finspot.in
 *
 * Usage:
 *   <script
 *     src="https://voice.santhira.com/integrations/finspot-embed.js"
 *     data-api-key="prefix_secretkey"
 *     data-tenant-id="your-tenant-uuid"
 *     data-lang="en">
 *   </script>
 *
 * Or with JWT:
 *   <script
 *     src="https://voice.santhira.com/integrations/finspot-embed.js"
 *     data-token="your-jwt-token"
 *     data-lang="en">
 *   </script>
 */
(function () {
  'use strict';

  // ---- Read config from script tag ----
  var scriptEl = document.currentScript;
  var CFG = {
    serverUrl: scriptEl.getAttribute('data-server') || scriptEl.src.replace(/\/integrations\/finspot-embed\.js.*$/, ''),
    token: scriptEl.getAttribute('data-token') || '',
    apiKey: scriptEl.getAttribute('data-api-key') || '',
    tenantId: scriptEl.getAttribute('data-tenant-id') || '',
    lang: scriptEl.getAttribute('data-lang') || 'en',
    personaId: scriptEl.getAttribute('data-persona') || '',
    position: scriptEl.getAttribute('data-position') || 'bottom-right', // bottom-right | bottom-left
    theme: scriptEl.getAttribute('data-theme') || 'dark', // dark | light
  };

  // ---- Styles ----
  var isDark = CFG.theme === 'dark';
  var COLORS = {
    primary: '#4f46e5',
    primaryHover: '#4338ca',
    bg: isDark ? '#111827' : '#ffffff',
    surface: isDark ? '#1f2937' : '#f3f4f6',
    text: isDark ? '#f1f5f9' : '#111827',
    muted: isDark ? '#94a3b8' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    userBubble: '#4f46e5',
    agentBubble: isDark ? '#1f2937' : '#f3f4f6',
  };

  var CSS = '\
#fs-voice-fab{position:fixed;z-index:99999;width:56px;height:56px;border-radius:50%;background:' + COLORS.primary + ';border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(79,70,229,0.4);transition:all .3s}' +
(CFG.position === 'bottom-left' ? '#fs-voice-fab{left:20px;bottom:20px}' : '#fs-voice-fab{right:20px;bottom:20px}') +
'#fs-voice-fab:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(79,70,229,0.5)}\
#fs-voice-fab.active{background:#ef4444;animation:fs-pulse 1.5s infinite}\
@keyframes fs-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 16px transparent}}\
#fs-voice-panel{position:fixed;z-index:99998;width:380px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 100px);border-radius:16px;background:' + COLORS.bg + ';border:1px solid ' + COLORS.border + ';box-shadow:0 20px 60px rgba(0,0,0,0.3);display:none;flex-direction:column;overflow:hidden;animation:fs-slideUp .3s ease}' +
(CFG.position === 'bottom-left' ? '#fs-voice-panel{left:20px;bottom:88px}' : '#fs-voice-panel{right:20px;bottom:88px}') +
'#fs-voice-panel.open{display:flex}\
@keyframes fs-slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}\
.fs-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid ' + COLORS.border + '}\
.fs-header-title{font-size:14px;font-weight:700;color:' + COLORS.text + '}\
.fs-header-status{font-size:11px;padding:3px 8px;border-radius:12px;font-weight:600}\
.fs-header-status.on{background:rgba(16,185,129,0.15);color:#10b981}\
.fs-header-status.off{background:rgba(239,68,68,0.15);color:#ef4444}\
.fs-header-close{background:none;border:none;cursor:pointer;color:' + COLORS.muted + ';padding:4px}\
.fs-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px}\
.fs-msg{max-width:80%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.5;animation:fs-fadeIn .2s ease}\
@keyframes fs-fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}\
.fs-msg.user{align-self:flex-end;background:' + COLORS.userBubble + ';color:#fff;border-bottom-right-radius:4px}\
.fs-msg.agent{align-self:flex-start;background:' + COLORS.agentBubble + ';color:' + COLORS.text + ';border-bottom-left-radius:4px}\
.fs-msg.system{align-self:center;font-size:11px;color:' + COLORS.muted + '}\
.fs-msg audio{width:100%;height:28px;margin-top:6px}\
.fs-typing{align-self:flex-start;padding:12px 16px;background:' + COLORS.agentBubble + ';border-radius:12px;border-bottom-left-radius:4px;display:none;gap:4px}\
.fs-typing.on{display:flex}\
.fs-typing span{width:6px;height:6px;border-radius:50%;background:' + COLORS.muted + ';animation:fs-dot 1.4s infinite}\
.fs-typing span:nth-child(2){animation-delay:.2s}\
.fs-typing span:nth-child(3){animation-delay:.4s}\
@keyframes fs-dot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}\
.fs-controls{display:flex;align-items:center;gap:8px;padding:12px 14px;border-top:1px solid ' + COLORS.border + '}\
.fs-record-btn{width:42px;height:42px;border-radius:50%;background:' + COLORS.primary + ';border:none;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s}\
.fs-record-btn:disabled{opacity:.4;cursor:not-allowed}\
.fs-record-btn.rec{background:#ef4444;animation:fs-pulse 1.5s infinite}\
.fs-text-input{flex:1;padding:10px 12px;border:1px solid ' + COLORS.border + ';border-radius:10px;background:' + COLORS.surface + ';color:' + COLORS.text + ';font-size:13px;outline:none}\
.fs-text-input:focus{border-color:' + COLORS.primary + '}\
.fs-text-input::placeholder{color:' + COLORS.muted + '}\
.fs-text-input:disabled{opacity:.5}\
';

  // Inject styles
  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ---- DOM ----
  // FAB button
  var fab = document.createElement('button');
  fab.id = 'fs-voice-fab';
  fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  fab.title = 'Voice Agent';
  document.body.appendChild(fab);

  // Panel
  var panel = document.createElement('div');
  panel.id = 'fs-voice-panel';
  panel.innerHTML = '\
<div class="fs-header">\
  <span class="fs-header-title">Finspot Voice Agent</span>\
  <span class="fs-header-status off" id="fs-status">Offline</span>\
  <button class="fs-header-close" id="fs-close">\
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>\
  </button>\
</div>\
<div class="fs-messages" id="fs-messages">\
  <div class="fs-msg system">Click the mic to start speaking</div>\
</div>\
<div class="fs-typing" id="fs-typing"><span></span><span></span><span></span></div>\
<div class="fs-controls">\
  <button class="fs-record-btn" id="fs-rec" disabled>\
    <svg id="fs-mic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>\
    <svg id="fs-stop" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>\
  </button>\
  <input class="fs-text-input" id="fs-input" placeholder="Type a message..." disabled />\
</div>';
  document.body.appendChild(panel);

  // ---- Elements ----
  var elStatus = document.getElementById('fs-status');
  var elMessages = document.getElementById('fs-messages');
  var elTyping = document.getElementById('fs-typing');
  var elRec = document.getElementById('fs-rec');
  var elInput = document.getElementById('fs-input');
  var elClose = document.getElementById('fs-close');
  var elMic = document.getElementById('fs-mic');
  var elStop = document.getElementById('fs-stop');

  // ---- State ----
  var socket = null;
  var recorder = null;
  var stream = null;
  var recording = false;
  var sessionActive = false;
  var panelOpen = false;

  // ---- Toggle panel ----
  fab.onclick = function () {
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
    if (panelOpen && !socket) connectSocket();
  };
  elClose.onclick = function () {
    panelOpen = false;
    panel.classList.remove('open');
  };

  // ---- Add message ----
  function msg(text, cls, audioB64) {
    var d = document.createElement('div');
    d.className = 'fs-msg ' + cls;
    d.textContent = text;
    if (audioB64) {
      var a = document.createElement('audio');
      a.controls = true;
      a.src = 'data:audio/wav;base64,' + audioB64;
      d.appendChild(a);
      a.play().catch(function () {});
    }
    elMessages.appendChild(d);
    elMessages.scrollTop = elMessages.scrollHeight;
  }

  function typing(on) { elTyping.classList.toggle('on', on); }

  // ---- Socket.IO ----
  function loadSocketIO(cb) {
    if (window.io) return cb();
    var s = document.createElement('script');
    s.src = CFG.serverUrl + '/socket.io/socket.io.js';
    s.onload = cb;
    s.onerror = function () {
      // Fallback CDN
      var s2 = document.createElement('script');
      s2.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
      s2.onload = cb;
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  }

  function connectSocket() {
    loadSocketIO(function () {
      var auth = {};
      if (CFG.token) {
        auth.token = CFG.token.replace(/^Bearer\s+/i, '');
      } else if (CFG.apiKey) {
        auth.apiKey = CFG.apiKey;
        auth.tenantId = CFG.tenantId;
      } else {
        msg('No auth credentials configured', 'system');
        return;
      }

      elStatus.textContent = 'Connecting...';
      elStatus.className = 'fs-header-status off';

      socket = io(CFG.serverUrl, {
        auth: auth,
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 3,
      });

      socket.on('connect', function () {
        elStatus.textContent = 'Online';
        elStatus.className = 'fs-header-status on';
        socket.emit('start-session', {
          language: CFG.lang,
          persona_id: CFG.personaId || undefined,
        });
      });

      socket.on('session-ready', function (data) {
        sessionActive = true;
        elRec.disabled = false;
        elInput.disabled = false;
        msg('Ready - tap the mic to speak', 'system');
      });

      socket.on('transcript', function (data) {
        typing(false);
        msg(data.text, 'user');
        typing(true);
      });

      socket.on('response-text', function (data) {
        typing(false);
        msg(data.text, 'agent');
      });

      socket.on('audio-response', function (data) {
        typing(false);
        if (data.audio) msg('', 'agent', data.audio);
      });

      socket.on('error', function (data) {
        typing(false);
        msg('Error: ' + (data.message || 'Unknown'), 'system');
      });

      socket.on('session-timeout', function () {
        typing(false);
        sessionActive = false;
        msg('Session timed out', 'system');
        elStatus.textContent = 'Timed out';
        elStatus.className = 'fs-header-status off';
        disableAll();
      });

      socket.on('disconnect', function () {
        sessionActive = false;
        elStatus.textContent = 'Offline';
        elStatus.className = 'fs-header-status off';
        disableAll();
      });

      socket.on('connect_error', function (err) {
        msg('Connection failed: ' + err.message, 'system');
        elStatus.textContent = 'Error';
        elStatus.className = 'fs-header-status off';
      });
    });
  }

  function disableAll() {
    elRec.disabled = true;
    elInput.disabled = true;
    stopRec();
  }

  // ---- Recording ----
  elRec.onclick = function () {
    if (recording) stopRec(); else startRec();
  };

  function startRec() {
    if (!socket || !sessionActive) return;
    navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    }).then(function (s) {
      stream = s;
      recorder = new MediaRecorder(s, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = function (e) {
        if (e.data.size > 0 && socket && socket.connected) {
          e.data.arrayBuffer().then(function (buf) { socket.emit('audio-chunk', buf); });
        }
      };
      recorder.start(250);
      recording = true;
      fab.classList.add('active');
      elRec.classList.add('rec');
      elMic.style.display = 'none';
      elStop.style.display = '';
    }).catch(function (err) {
      msg('Mic error: ' + err.message, 'system');
    });
  }

  function stopRec() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    recording = false;
    fab.classList.remove('active');
    elRec.classList.remove('rec');
    elMic.style.display = '';
    elStop.style.display = 'none';
  }

  // ---- Text input ----
  elInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var text = elInput.value.trim();
      if (!text || !socket || !sessionActive) return;
      msg(text, 'user');
      elInput.value = '';
      typing(true);
      socket.emit('text-message', { text: text });
    }
  });
})();
