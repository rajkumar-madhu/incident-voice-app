import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { ragLatency } from '../utils/metrics.js';

export interface RAGResult {
  documents: Array<{
    id: string;
    title: string;
    content: string;
    similarity: number;
  }>;
  count: number;
}

export const retrieveContext = async (
  queryText: string,
  tenantId: string,
  requestId?: string,
): Promise<RAGResult | null> => {
  const start = Date.now();
  try {
    const response = await axios.post(
      `${config.ragServiceUrl}/v1/retrieve`,
      {
        query: queryText,
        tenant_id: tenantId,
        top_k: 5,
        threshold: 0.3,
      },
      {
        timeout: config.ragTimeoutMs,
        headers: {
          'X-Tenant-ID': tenantId,
          'X-Request-ID': requestId || '',
          'Content-Type': 'application/json',
        },
      }
    );

    const duration = (Date.now() - start) / 1000;
    ragLatency.observe(duration);

    logger.info({ duration, results: response.data?.data?.count, requestId }, 'RAG retrieval completed');
    return response.data?.data || null;
  } catch (err) {
    const duration = (Date.now() - start) / 1000;
    ragLatency.observe(duration);
    logger.warn({ err: (err as Error).message, duration, requestId }, 'RAG retrieval failed, proceeding without context');
    return null;
  }
};
