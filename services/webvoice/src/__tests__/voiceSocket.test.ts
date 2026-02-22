import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/redis.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue({
    ping: vi.fn(), setEx: vi.fn(), get: vi.fn(), del: vi.fn(),
  }),
  checkRedisConnection: vi.fn().mockResolvedValue(true),
  closeRedis: vi.fn(),
}));

vi.mock('../config.js', () => ({
  config: {
    port: 4004, nodeEnv: 'test', redisUrl: 'redis://localhost:6379',
    jwtSecret: 'test-secret-key-that-is-at-least-32-chars-long',
    widgetAllowedOrigins: '*',
    sttServiceUrl: 'http://localhost:8001', ttsServiceUrl: 'http://localhost:8002',
    orchestratorUrl: 'http://localhost:4002',
    sessionTimeoutMs: 300000, maxSessionDurationMs: 1800000,
    audioSampleRate: 16000, vadSilenceThresholdMs: 1500, vadEnergyThreshold: 0.01,
    logLevel: 'error',
  },
}));

import { VADService } from '../services/vadService.js';
import { AudioBufferManager } from '../services/audioService.js';

describe('VADService', () => {
  it('should detect silence', () => {
    const vad = new VADService();
    const silentBuffer = Buffer.alloc(1024, 0);
    const result = vad.processChunk(silentBuffer);
    expect(result.isSilent).toBe(true);
  });
});

describe('AudioBufferManager', () => {
  it('should manage audio chunks', () => {
    const manager = new AudioBufferManager();
    const chunk = Buffer.from('test audio data');
    manager.addChunk(chunk);
    expect(manager.chunkCount).toBe(1);
    expect(manager.size).toBe(chunk.length);

    const buffer = manager.getBuffer();
    expect(buffer.length).toBe(chunk.length);

    manager.clear();
    expect(manager.size).toBe(0);
  });
});
