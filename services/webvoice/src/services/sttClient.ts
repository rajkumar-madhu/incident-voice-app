import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { sttRequests } from '../utils/metrics.js';

export const transcribeAudio = async (
  audioBase64: string,
  language?: string,
  tenantId?: string,
  requestId?: string,
): Promise<{ text: string; language: string; confidence: number }> => {
  try {
    const response = await axios.post(
      `${config.sttServiceUrl}/v1/transcribe`,
      { audio: audioBase64, language },
      {
        timeout: 30000,
        headers: {
          'X-Tenant-ID': tenantId || '',
          'X-Request-ID': requestId || '',
          'Content-Type': 'application/json',
        },
      }
    );

    sttRequests.inc({ status: 'success' });
    return response.data?.data || { text: '', language: language || 'en', confidence: 0 };
  } catch (err) {
    sttRequests.inc({ status: 'error' });
    logger.error({ err: (err as Error).message }, 'STT request failed');
    throw new Error('Transcription failed');
  }
};
