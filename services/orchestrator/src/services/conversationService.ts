import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/postgres.js';
import { logger } from '../utils/logger.js';
import type { Conversation, ConversationMessage } from '../types/index.js';
import { config } from '../config.js';

export const getOrCreateConversation = async (
  tenantId: string,
  conversationId?: string,
): Promise<Conversation> => {
  if (conversationId) {
    const rows = await query<Conversation>(
      'SELECT * FROM conversations WHERE id = $1 AND tenant_id = $2 AND status = $3',
      [conversationId, tenantId, 'active']
    );
    if (rows.length > 0) return rows[0];
  }

  const id = conversationId || uuidv4();
  const rows = await query<Conversation>(
    `INSERT INTO conversations (id, tenant_id, status, metadata)
     VALUES ($1, $2, 'active', '{}') RETURNING *`,
    [id, tenantId]
  );
  logger.info({ conversationId: id, tenantId }, 'Created new conversation');
  return rows[0];
};

export const saveMessage = async (
  conversationId: string,
  tenantId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<ConversationMessage> => {
  const rows = await query<ConversationMessage>(
    `INSERT INTO conversation_messages (conversation_id, tenant_id, role, content, metadata)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [conversationId, tenantId, role, content, JSON.stringify(metadata)]
  );
  return rows[0];
};

export const getConversationHistory = async (
  conversationId: string,
  tenantId: string,
  limit?: number,
): Promise<ConversationMessage[]> => {
  const maxMessages = limit || config.maxConversationHistory;
  const rows = await query<ConversationMessage>(
    `SELECT * FROM conversation_messages
     WHERE conversation_id = $1 AND tenant_id = $2
     ORDER BY created_at DESC LIMIT $3`,
    [conversationId, tenantId, maxMessages]
  );
  return rows.reverse();
};
