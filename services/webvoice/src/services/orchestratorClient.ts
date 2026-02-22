import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const chat = async (
  message: string,
  conversationId?: string,
  tenantId?: string,
  requestId?: string,
): Promise<{ conversation_id: string; response: string }> => {
  try {
    const response = await axios.post(
      `${config.orchestratorUrl}/v1/chat`,
      { message, conversation_id: conversationId },
      {
        timeout: 60000,
        headers: {
          'X-Tenant-ID': tenantId || '',
          'X-Request-ID': requestId || '',
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data?.data || { conversation_id: '', response: '' };
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Orchestrator request failed');
    throw new Error('Chat processing failed');
  }
};
