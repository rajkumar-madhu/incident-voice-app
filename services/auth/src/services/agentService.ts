import { query, transaction } from '../db/postgres.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import type { CreateAgent, UpdateAgent, Agent } from '../types/dashboard.js';

export const createAgent = async (
  tenantId: string,
  data: CreateAgent
): Promise<Agent> => {
  const existing = await query<{ id: string }>(
    'SELECT id FROM agents WHERE tenant_id = $1 AND name = $2',
    [tenantId, data.name]
  );

  if (existing.length > 0) {
    throw new ConflictError('Agent with this name already exists');
  }

  const agents = await query<Agent>(
    `INSERT INTO agents (
      tenant_id, name, description, system_prompt, model, temperature,
      max_tokens, voice_id, language, greeting_message, end_call_phrases,
      enabled_tools, rag_enabled, rag_collection_id, webhook_url, webhook_events,
      webhook_secret
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
    [
      tenantId, data.name, data.description || null, data.system_prompt,
      data.model, data.temperature, data.max_tokens, data.voice_id,
      data.language, data.greeting_message || null,
      data.end_call_phrases || ['goodbye', 'bye', 'end call'],
      JSON.stringify(data.enabled_tools || []), data.rag_enabled,
      data.rag_collection_id || null, data.webhook_url || null,
      data.webhook_events || ['call.completed', 'call.failed'],
      data.webhook_secret || null,
    ]
  );

  logger.info({ agentId: agents[0].id, tenantId }, 'Agent created');
  return agents[0];
};

export const getAgentById = async (
  agentId: string,
  tenantId: string
): Promise<Agent> => {
  const agents = await query<Agent>(
    'SELECT * FROM agents WHERE id = $1 AND tenant_id = $2',
    [agentId, tenantId]
  );

  if (agents.length === 0) {
    throw new NotFoundError('Agent');
  }

  return agents[0];
};

export const listAgents = async (
  tenantId: string,
  includeInactive = false
): Promise<Agent[]> => {
  const whereClause = includeInactive
    ? 'WHERE tenant_id = $1'
    : 'WHERE tenant_id = $1 AND is_active = true';

  return query<Agent>(
    `SELECT * FROM agents ${whereClause} ORDER BY created_at DESC`,
    [tenantId]
  );
};

export const updateAgent = async (
  agentId: string,
  tenantId: string,
  data: UpdateAgent
): Promise<Agent> => {
  const existing = await getAgentById(agentId, tenantId);

  if (data.name && data.name !== existing.name) {
    const duplicate = await query<{ id: string }>(
      'SELECT id FROM agents WHERE tenant_id = $1 AND name = $2 AND id != $3',
      [tenantId, data.name, agentId]
    );
    if (duplicate.length > 0) {
      throw new ConflictError('Agent with this name already exists');
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  const fieldMap: Record<string, unknown> = {
    name: data.name,
    description: data.description,
    system_prompt: data.system_prompt,
    model: data.model,
    temperature: data.temperature,
    max_tokens: data.max_tokens,
    voice_id: data.voice_id,
    language: data.language,
    greeting_message: data.greeting_message,
    end_call_phrases: data.end_call_phrases,
    enabled_tools: data.enabled_tools ? JSON.stringify(data.enabled_tools) : undefined,
    rag_enabled: data.rag_enabled,
    rag_collection_id: data.rag_collection_id,
    webhook_url: data.webhook_url,
    webhook_events: data.webhook_events,
    webhook_secret: data.webhook_secret,
  };

  for (const [key, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) {
    return existing;
  }

  values.push(agentId, tenantId);
  const agents = await query<Agent>(
    `UPDATE agents SET ${fields.join(', ')}
     WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
     RETURNING *`,
    values
  );

  logger.info({ agentId, tenantId }, 'Agent updated');
  return agents[0];
};

export const deleteAgent = async (
  agentId: string,
  tenantId: string
): Promise<void> => {
  await getAgentById(agentId, tenantId);

  await query(
    'UPDATE agents SET is_active = false WHERE id = $1 AND tenant_id = $2',
    [agentId, tenantId]
  );

  logger.info({ agentId, tenantId }, 'Agent deactivated');
};

export const duplicateAgent = async (
  agentId: string,
  tenantId: string
): Promise<Agent> => {
  const source = await getAgentById(agentId, tenantId);

  let copyName = `${source.name} (copy)`;
  let suffix = 2;
  while (true) {
    const existing = await query<{ id: string }>(
      'SELECT id FROM agents WHERE tenant_id = $1 AND name = $2',
      [tenantId, copyName]
    );
    if (existing.length === 0) break;
    copyName = `${source.name} (copy ${suffix})`;
    suffix++;
  }

  return createAgent(tenantId, {
    name: copyName,
    description: source.description || undefined,
    system_prompt: source.system_prompt,
    model: source.model,
    temperature: Number(source.temperature),
    max_tokens: source.max_tokens,
    voice_id: source.voice_id,
    language: source.language,
    greeting_message: source.greeting_message || undefined,
    end_call_phrases: source.end_call_phrases,
    enabled_tools: source.enabled_tools as Record<string, unknown>[] | undefined,
    rag_enabled: source.rag_enabled,
    rag_collection_id: source.rag_collection_id || undefined,
    webhook_url: source.webhook_url || undefined,
    webhook_events: source.webhook_events,
    webhook_secret: source.webhook_secret || undefined,
  });
};
