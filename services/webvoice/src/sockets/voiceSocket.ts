import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { audioChunksProcessed } from '../utils/metrics.js';
import { createSession, getSession, updateSessionActivity, destroySession, isSessionExpired } from './sessionManager.js';
import { VADService } from '../services/vadService.js';
import { AudioBufferManager } from '../services/audioService.js';
import { transcribeAudio } from '../services/sttClient.js';
import { synthesizeSpeech } from '../services/ttsClient.js';
import { chat } from '../services/orchestratorClient.js';
import { config } from '../config.js';
import type { VoiceSession } from '../types/index.js';

interface SocketWithAuth extends Socket {
  authContext?: {
    tenantId: string;
    userId?: string;
    apiKeyId?: string;
  };
  voiceSession?: VoiceSession;
  vad?: VADService;
  audioBuffer?: AudioBufferManager;
  idleTimer?: ReturnType<typeof setTimeout>;
}

export const setupVoiceSocket = (io: Server): void => {
  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as SocketWithAuth;
    const auth = socket.authContext;

    if (!auth) {
      socket.emit('error', { code: 'AUTH_ERROR', message: 'Not authenticated' });
      socket.disconnect();
      return;
    }

    logger.info({ socketId: socket.id, tenantId: auth.tenantId }, 'Socket connected');

    // Start session
    socket.on('start-session', async (data?: { language?: string; persona_id?: string }) => {
      try {
        const session = await createSession(auth.tenantId, auth.userId, auth.apiKeyId);
        socket.voiceSession = session;
        socket.vad = new VADService();
        socket.audioBuffer = new AudioBufferManager();

        // Set idle timeout
        socket.idleTimer = setTimeout(() => {
          socket.emit('session-timeout', { reason: 'idle' });
          handleEndSession(socket);
        }, config.sessionTimeoutMs);

        socket.emit('session-ready', {
          session_id: session.id,
          sample_rate: config.audioSampleRate,
          language: data?.language || 'en',
        });

        logger.info({ sessionId: session.id, tenantId: auth.tenantId }, 'Voice session started');
      } catch (err) {
        logger.error({ err: (err as Error).message }, 'Failed to start session');
        socket.emit('error', { code: 'SESSION_ERROR', message: 'Failed to start session' });
      }
    });

    // Audio chunk
    socket.on('audio-chunk', async (chunk: ArrayBuffer) => {
      if (!socket.voiceSession || !socket.vad || !socket.audioBuffer) {
        return socket.emit('error', { code: 'NO_SESSION', message: 'No active session' });
      }

      // Check session expiry
      const session = await getSession(socket.voiceSession.id);
      if (!session || isSessionExpired(session)) {
        socket.emit('session-timeout', { reason: 'expired' });
        return handleEndSession(socket);
      }

      // Reset idle timer
      if (socket.idleTimer) {
        clearTimeout(socket.idleTimer);
        socket.idleTimer = setTimeout(() => {
          socket.emit('session-timeout', { reason: 'idle' });
          handleEndSession(socket);
        }, config.sessionTimeoutMs);
      }

      await updateSessionActivity(socket.voiceSession.id);

      const audioData = Buffer.from(chunk);
      socket.audioBuffer.addChunk(audioData);
      audioChunksProcessed.inc({ status: 'received' });

      // VAD processing
      const { shouldFinalize } = socket.vad.processChunk(audioData);

      if (shouldFinalize && socket.audioBuffer.size > 0) {
        await processAudio(socket);
      }
    });

    // End session
    socket.on('end-session', () => {
      handleEndSession(socket);
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Socket disconnected');
      handleEndSession(socket);
    });
  });
};

const processAudio = async (socket: SocketWithAuth): Promise<void> => {
  if (!socket.voiceSession || !socket.audioBuffer) return;

  const audioBase64 = socket.audioBuffer.getBase64();
  socket.audioBuffer.clear();
  socket.vad?.reset();

  try {
    // 1. STT
    const transcript = await transcribeAudio(
      audioBase64,
      undefined,
      socket.authContext?.tenantId,
    );

    if (!transcript.text.trim()) return;

    socket.emit('transcript', {
      text: transcript.text,
      language: transcript.language,
      confidence: transcript.confidence,
    });

    // 2. Orchestrator
    const chatResult = await chat(
      transcript.text,
      socket.voiceSession.conversationId,
      socket.authContext?.tenantId,
    );

    // Store conversation ID for continuity
    if (chatResult.conversation_id && socket.voiceSession) {
      socket.voiceSession.conversationId = chatResult.conversation_id;
    }

    socket.emit('response-text', {
      text: chatResult.response,
      conversation_id: chatResult.conversation_id,
    });

    // 3. TTS
    const ttsResult = await synthesizeSpeech(
      chatResult.response,
      transcript.language,
      undefined,
      socket.authContext?.tenantId,
    );

    socket.emit('audio-response', {
      audio: ttsResult.audio_base64,
      duration_ms: ttsResult.duration_ms,
    });

    audioChunksProcessed.inc({ status: 'processed' });
  } catch (err) {
    logger.error({ err: (err as Error).message, sessionId: socket.voiceSession?.id }, 'Audio processing failed');
    socket.emit('error', { code: 'PROCESSING_ERROR', message: 'Failed to process audio' });
  }
};

const handleEndSession = async (socket: SocketWithAuth): Promise<void> => {
  if (socket.idleTimer) {
    clearTimeout(socket.idleTimer);
    socket.idleTimer = undefined;
  }

  if (socket.voiceSession) {
    await destroySession(socket.voiceSession.id);
    socket.voiceSession = undefined;
  }

  socket.vad = undefined;
  socket.audioBuffer?.clear();
  socket.audioBuffer = undefined;
};
