import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { ttsRequests } from '../utils/metrics.js';

export const synthesizeSpeech = async (
  text: string,
  language?: string,
  personaId?: string,
  tenantId?: string,
  requestId?: string,
): Promise<{ audio_base64: string; duration_ms: number }> => {
  try {
    const response = await axios.post(
      `${config.ttsServiceUrl}/v1/synthesize`,
      { text, language: language || 'en', persona_id: personaId },
      {
        timeout: 30000,
        headers: {
          'X-Tenant-ID': tenantId || '',
          'X-Request-ID': requestId || '',
          'Content-Type': 'application/json',
        },
      }
    );

    ttsRequests.inc({ status: 'success' });
    return response.data?.data || { audio_base64: '', duration_ms: 0 };
  } catch (err) {
    ttsRequests.inc({ status: 'error' });
    logger.error({ err: (err as Error).message }, 'TTS request failed');
    throw new Error('Speech synthesis failed');
  }
};
