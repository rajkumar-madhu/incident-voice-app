/**
 * WeCrew Voice Widget SDK
 * Embeddable client for web voice interactions
 */
(function(window) {
  'use strict';

  var DEFAULT_CONFIG = {
    sampleRate: 16000,
    silenceThreshold: 1500,
  };

  function WeCrewVoiceWidget(options) {
    this.serverUrl = options.serverUrl;
    this.token = options.token;
    this.apiKey = options.apiKey;
    this.tenantId = options.tenantId;
    this.language = options.language || 'en';
    this.personaId = options.personaId;
    this.onTranscript = options.onTranscript || function() {};
    this.onResponse = options.onResponse || function() {};
    this.onAudio = options.onAudio || function() {};
    this.onError = options.onError || function() {};
    this.onSessionReady = options.onSessionReady || function() {};
    this.onSessionTimeout = options.onSessionTimeout || function() {};

    this.socket = null;
    this.mediaRecorder = null;
    this.stream = null;
    this.isRecording = false;
    this.sessionId = null;
  }

  WeCrewVoiceWidget.prototype.connect = function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      // Dynamically load socket.io client
      if (!window.io) {
        var script = document.createElement('script');
        script.src = self.serverUrl + '/socket.io/socket.io.js';
        script.onload = function() { self._initSocket(resolve, reject); };
        script.onerror = function() { reject(new Error('Failed to load Socket.IO client')); };
        document.head.appendChild(script);
      } else {
        self._initSocket(resolve, reject);
      }
    });
  };

  WeCrewVoiceWidget.prototype._initSocket = function(resolve, reject) {
    var self = this;
    var authData = {};
    if (this.token) authData.token = this.token;
    if (this.apiKey) { authData.apiKey = this.apiKey; authData.tenantId = this.tenantId; }

    this.socket = window.io(this.serverUrl, { auth: authData, transports: ['websocket'] });

    this.socket.on('connect', function() { resolve(); });
    this.socket.on('connect_error', function(err) { reject(err); });

    this.socket.on('session-ready', function(data) {
      self.sessionId = data.session_id;
      self.onSessionReady(data);
    });

    this.socket.on('transcript', this.onTranscript);
    this.socket.on('response-text', this.onResponse);
    this.socket.on('audio-response', function(data) {
      self.onAudio(data);
      self._playAudio(data.audio);
    });
    this.socket.on('error', this.onError);
    this.socket.on('session-timeout', function(data) {
      self.isRecording = false;
      self.onSessionTimeout(data);
    });
  };

  WeCrewVoiceWidget.prototype.startSession = function() {
    if (!this.socket) throw new Error('Not connected');
    this.socket.emit('start-session', { language: this.language, persona_id: this.personaId });
  };

  WeCrewVoiceWidget.prototype.startRecording = function() {
    var self = this;
    if (!this.socket || !this.sessionId) throw new Error('No active session');

    return navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: DEFAULT_CONFIG.sampleRate, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    }).then(function(stream) {
      self.stream = stream;

      self.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      self.mediaRecorder.ondataavailable = function(event) {
        if (event.data.size > 0 && self.socket) {
          event.data.arrayBuffer().then(function(buffer) {
            self.socket.emit('audio-chunk', buffer);
          });
        }
      };

      self.mediaRecorder.start(250); // Send chunks every 250ms
      self.isRecording = true;
    });
  };

  WeCrewVoiceWidget.prototype.stopRecording = function() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(function(track) { track.stop(); });
      this.stream = null;
    }
  };

  WeCrewVoiceWidget.prototype.endSession = function() {
    this.stopRecording();
    if (this.socket) this.socket.emit('end-session');
    this.sessionId = null;
  };

  WeCrewVoiceWidget.prototype.disconnect = function() {
    this.endSession();
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
  };

  WeCrewVoiceWidget.prototype._playAudio = function(base64Audio) {
    try {
      var audioData = atob(base64Audio);
      var arrayBuffer = new ArrayBuffer(audioData.length);
      var view = new Uint8Array(arrayBuffer);
      for (var i = 0; i < audioData.length; i++) view[i] = audioData.charCodeAt(i);

      var audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContext.decodeAudioData(arrayBuffer, function(buffer) {
        var source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
      });
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  };

  window.WeCrewVoiceWidget = WeCrewVoiceWidget;
  /** @deprecated Use WeCrewVoiceWidget */
  window.LinkedEyeVoiceWidget = WeCrewVoiceWidget;
})(window);
