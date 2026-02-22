import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { ChatRequestSchema } from '../types/index.js';
import { getOrCreateConversation, saveMessage, getConversationHistory } from '../services/conversationService.js';
import { retrieveContext } from '../services/ragService.js';
import { callLLM } from '../services/llmService.js';
import { chatRequestsTotal } from '../utils/metrics.js';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../middleware/errorHandler.js';

const router = Router();

router.post('/v1/chat', authenticate, rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = ChatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid chat request', parseResult.error.errors);
    }

    const { message, conversation_id, metadata } = parseResult.data;
    const tenantId = req.context!.tenant_id;
    const requestId = req.headers['x-request-id'] as string;

    logger.info({ tenantId, conversationId: conversation_id, requestId }, 'Processing chat request');

    // 1. Get or create conversation
    const conversation = await getOrCreateConversation(tenantId, conversation_id);

    // 2. Save user message
    await saveMessage(conversation.id, tenantId, 'user', message, metadata || {});

    // 3. Load conversation history
    const history = await getConversationHistory(conversation.id, tenantId);

    // 4. Call RAG service for context (graceful fallback)
    const ragResult = await retrieveContext(message, tenantId, requestId);
    let ragContext: string | null = null;
    if (ragResult && ragResult.documents.length > 0) {
      ragContext = ragResult.documents
        .map((doc) => `[${doc.title}]: ${doc.content}`)
        .join('\n\n');
    }

    // 5. Call LLM via Flowise
    const llmResponse = await callLLM(message, history, ragContext, requestId);

    // 6. Save assistant message
    await saveMessage(conversation.id, tenantId, 'assistant', llmResponse.text, {
      rag_documents: ragResult?.count || 0,
    });

    chatRequestsTotal.inc({ status: 'success' });

    logger.info({
      tenantId,
      conversationId: conversation.id,
      requestId,
      ragDocs: ragResult?.count || 0,
    }, 'Chat request completed');

    res.json({
      success: true,
      data: {
        conversation_id: conversation.id,
        response: llmResponse.text,
        tool_calls: llmResponse.tool_calls || [],
      },
    });
  } catch (err) {
    chatRequestsTotal.inc({ status: 'error' });
    next(err);
  }
});

export default router;
