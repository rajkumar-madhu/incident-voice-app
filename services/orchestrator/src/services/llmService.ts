import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { llmLatency } from '../utils/metrics.js';
import type { ConversationMessage } from '../types/index.js';

interface LLMResponse {
  text: string;
  tool_calls?: unknown[];
}

export const callLLM = async (
  userMessage: string,
  conversationHistory: ConversationMessage[],
  ragContext: string | null,
  requestId?: string,
): Promise<LLMResponse> => {
  const start = Date.now();

  // Build the prompt with context
  let systemPrompt = 'You are a helpful AI assistant for LinkedEye Voice Agent platform.';
  if (ragContext) {
    systemPrompt += `\n\nRelevant context from knowledge base:\n${ragContext}`;
  }

  // Format conversation history
  const history = conversationHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId || '',
    };
    if (config.flowiseApiKey) {
      headers['Authorization'] = `Bearer ${config.flowiseApiKey}`;
    }

    const response = await axios.post(
      `${config.flowiseUrl}/api/v1/prediction/${config.flowiseFlowId}`,
      {
        question: userMessage,
        history,
        overrideConfig: {
          systemMessagePrompt: systemPrompt,
        },
      },
      {
        timeout: config.llmTimeoutMs,
        headers,
      }
    );

    const duration = (Date.now() - start) / 1000;
    llmLatency.observe(duration);

    const responseText = response.data?.text || response.data?.result || response.data || '';

    logger.info({ duration, responseLength: String(responseText).length, requestId }, 'LLM response received');

    return {
      text: typeof responseText === 'string' ? responseText : JSON.stringify(responseText),
      tool_calls: response.data?.tool_calls,
    };
  } catch (err) {
    const duration = (Date.now() - start) / 1000;
    llmLatency.observe(duration);
    logger.error({ err: (err as Error).message, duration, requestId }, 'LLM call failed');
    throw new Error('Failed to get response from LLM');
  }
};
