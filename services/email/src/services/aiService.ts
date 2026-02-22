import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const generateAIResponse = async (
  emailBody: string,
  subject: string,
  tenantId: string,
  requestId?: string,
): Promise<string | null> => {
  try {
    const response = await axios.post(
      `${config.orchestratorUrl}/v1/chat`,
      {
        message: `Generate a professional email reply to the following email.\n\nSubject: ${subject}\n\nBody:\n${emailBody}`,
      },
      {
        timeout: 60000,
        headers: {
          'X-Tenant-ID': tenantId,
          'X-Request-ID': requestId || '',
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data?.data?.response || null;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'AI response generation failed');
    return null;
  }
};
