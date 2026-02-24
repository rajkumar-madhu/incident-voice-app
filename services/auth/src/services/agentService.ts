import { query, transaction } from '../db/postgres.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import type { CreateAgent, UpdateAgent, Agent } from '../types/dashboard.js';

/**
 * Strip sensitive fields from agent before returning to API consumers
 */
const sanitizeAgent = (agent: Agent): Omit<Agent, 'webhook_secret'> => {
  const { webhook_secret: _secret, ...safe } = agent;
  return safe;
};

export const createAgent = async (
  tenantId: string,
  data: CreateAgent
): Promise<Omit<Agent, 'webhook_secret'>> => {
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
  return sanitizeAgent(agents[0]);
};

/**
 * Internal: get full agent including webhook_secret (for duplication/webhook dispatch)
 */
const getAgentByIdInternal = async (
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

export const getAgentById = async (
  agentId: string,
  tenantId: string
): Promise<Omit<Agent, 'webhook_secret'>> => {
  return sanitizeAgent(await getAgentByIdInternal(agentId, tenantId));
};

export const listAgents = async (
  tenantId: string,
  includeInactive = false
): Promise<Omit<Agent, 'webhook_secret'>[]> => {
  const whereClause = includeInactive
    ? 'WHERE tenant_id = $1'
    : 'WHERE tenant_id = $1 AND is_active = true';

  const agents = await query<Agent>(
    `SELECT * FROM agents ${whereClause} ORDER BY created_at DESC`,
    [tenantId]
  );

  return agents.map(sanitizeAgent);
};

export const updateAgent = async (
  agentId: string,
  tenantId: string,
  data: UpdateAgent
): Promise<Omit<Agent, 'webhook_secret'>> => {
  const existing = await getAgentByIdInternal(agentId, tenantId);

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
  return sanitizeAgent(agents[0]);
};

export const deleteAgent = async (
  agentId: string,
  tenantId: string
): Promise<void> => {
  await getAgentByIdInternal(agentId, tenantId);

  await query(
    'UPDATE agents SET is_active = false WHERE id = $1 AND tenant_id = $2',
    [agentId, tenantId]
  );

  logger.info({ agentId, tenantId }, 'Agent deactivated');
};

export const duplicateAgent = async (
  agentId: string,
  tenantId: string
): Promise<Omit<Agent, 'webhook_secret'>> => {
  const source = await getAgentByIdInternal(agentId, tenantId);

  return await transaction(async (client) => {
    let copyName = `${source.name} (copy)`;
    let suffix = 2;
    const MAX_ATTEMPTS = 20;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const existing = await client.query(
        'SELECT id FROM agents WHERE tenant_id = $1 AND name = $2',
        [tenantId, copyName]
      );
      if (existing.rows.length === 0) break;
      copyName = `${source.name} (copy ${suffix})`;
      suffix++;
    }

    const enabledTools = Array.isArray(source.enabled_tools)
      ? source.enabled_tools
      : [];

    const agents = await client.query(
      `INSERT INTO agents (
        tenant_id, name, description, system_prompt, model, temperature,
        max_tokens, voice_id, language, greeting_message, end_call_phrases,
        enabled_tools, rag_enabled, rag_collection_id, webhook_url, webhook_events,
        webhook_secret
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        tenantId, copyName, source.description || null, source.system_prompt,
        source.model, Number(source.temperature), source.max_tokens, source.voice_id,
        source.language, source.greeting_message || null,
        source.end_call_phrases || ['goodbye', 'bye', 'end call'],
        JSON.stringify(enabledTools), source.rag_enabled,
        source.rag_collection_id || null, source.webhook_url || null,
        source.webhook_events || ['call.completed', 'call.failed'],
        source.webhook_secret || null,
      ]
    );

    const newAgent = agents.rows[0] as Agent;
    logger.info({ agentId: newAgent.id, sourceId: agentId, tenantId }, 'Agent duplicated');
    return sanitizeAgent(newAgent);
  });
};
