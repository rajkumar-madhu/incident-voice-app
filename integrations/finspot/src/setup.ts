/**
 * Finspot Voice Agent Setup Script
 *
 * Creates:
 *   1. API Key (for REST/WebSocket calls from Finspot app)
 *   2. Agent (with webhook config pointing to Finspot receiver)
 *
 * Usage:
 *   JWT_TOKEN=xxx FINSPOT_APP_URL=https://fs-le-dev-inc.finspot.in npx tsx src/setup.ts
 */

const VOICE_API_URL = process.env.VOICE_API_URL || 'https://voice.api.santhira.com';
const JWT_TOKEN = process.env.JWT_TOKEN || '';
const FINSPOT_APP_URL = process.env.FINSPOT_APP_URL || 'https://fs-le-dev-inc.finspot.in';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || `fswh_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;
const AGENT_NAME = process.env.AGENT_NAME || 'finspot-itsm-agent';
const AGENT_LANGUAGE = process.env.AGENT_LANGUAGE || 'en';
const WEBHOOK_PORT = process.env.PORT || '3100';

import crypto from 'crypto';

async function api(method: string, path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${VOICE_API_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    console.error(`API ${method} ${path} failed:`, data);
    process.exit(1);
  }
  return data;
}

async function main() {
  console.log('='.repeat(60));
  console.log('  Finspot Voice Agent Setup');
  console.log('='.repeat(60));
  console.log();

  if (!JWT_TOKEN) {
    console.error('ERROR: JWT_TOKEN environment variable required.');
    console.error('Get one by calling: POST /auth/login with your admin credentials');
    process.exit(1);
  }

  const webhookUrl = `${FINSPOT_APP_URL}:${WEBHOOK_PORT}/api/webhooks/voice`;

  // Step 1: Create API Key
  console.log('Step 1: Creating API Key...');
  const keyResult = await api('POST', '/api-keys', {
    name: `${AGENT_NAME}-key`,
    scopes: ['voice:read', 'voice:write'],
  });
  const apiKeyData = keyResult as { key?: string; data?: { key: string; id: string; key_prefix: string } };
  const rawKey = apiKeyData.key || apiKeyData.data?.key || '';
  const keyId = (apiKeyData as Record<string, unknown>).id || apiKeyData.data?.id || '';
  console.log(`  API Key created: ${rawKey.slice(0, 12)}...`);
  console.log(`  Key ID: ${keyId}`);
  console.log();

  // Step 2: Create Agent with webhook config
  console.log('Step 2: Creating Agent with webhook config...');
  const agentResult = await api('POST', '/agents', {
    name: AGENT_NAME,
    description: 'Finspot ITSM voice agent - handles incidents, problems, and change requests',
    system_prompt: `You are a Finspot IT Service Management voice assistant. Your job is to:
1. Help users report incidents (outages, errors, service disruptions)
2. Log recurring problems and identify patterns
3. Process change requests (access, upgrades, modifications)
4. Triage urgency: ask about impact, affected users, and timeline
5. Provide ticket reference numbers after logging

Always be professional, empathetic, and efficient. Ask clarifying questions to gather:
- What happened / what is needed
- When it started / when it's needed by
- Who and how many are affected
- Business impact (critical/high/medium/low)

Summarize the issue back to the caller before confirming.`,
    model: 'claude-sonnet-4-20250514',
    language: AGENT_LANGUAGE,
    greeting_message: 'Hello, this is Finspot IT support. How can I help you today?',
    end_call_phrases: ['goodbye', 'bye', 'end call', 'that\'s all', 'thank you bye'],
    webhook_url: webhookUrl,
    webhook_events: [
      'call.started',
      'call.transcribed',
      'call.responded',
      'call.completed',
      'call.failed',
      'call.abandoned',
      'incident.created',
      'problem.created',
      'change.requested',
    ],
    webhook_secret: WEBHOOK_SECRET,
  });
  const agentData = agentResult as { data?: { id: string; name: string } };
  const agentId = agentData.data?.id || (agentResult as Record<string, unknown>).id || '';
  console.log(`  Agent created: ${agentData.data?.name || AGENT_NAME}`);
  console.log(`  Agent ID: ${agentId}`);
  console.log();

  // Step 3: Print configuration summary
  console.log('='.repeat(60));
  console.log('  SETUP COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log('Save these values in your .env file:');
  console.log();
  console.log(`  WEBHOOK_SECRET=${WEBHOOK_SECRET}`);
  console.log(`  API_KEY=${rawKey}`);
  console.log(`  AGENT_ID=${agentId}`);
  console.log();
  console.log('--- Webhook Receiver ---');
  console.log(`  Start:    cd integrations/finspot && npm run dev`);
  console.log(`  Endpoint: POST ${webhookUrl}`);
  console.log(`  Events:   call.*, incident.created, problem.created, change.requested`);
  console.log();
  console.log('--- Embed Widget (add to any Finspot page) ---');
  console.log();
  console.log(`  <script`);
  console.log(`    src="${process.env.VOICE_WS_URL || 'https://voice.santhira.com'}/integrations/finspot-embed.js"`);
  console.log(`    data-api-key="${rawKey}"`);
  console.log(`    data-tenant-id="YOUR_TENANT_ID"`);
  console.log(`    data-lang="${AGENT_LANGUAGE}">`);
  console.log(`  </script>`);
  console.log();
  console.log('--- REST API (from Finspot backend) ---');
  console.log();
  console.log(`  curl -X POST ${VOICE_API_URL}/v1/voice/chat \\`);
  console.log(`    -H "X-API-Key: ${rawKey.slice(0, 12)}..." \\`);
  console.log(`    -d '{"text":"I need to report an outage","language":"${AGENT_LANGUAGE}"}'`);
  console.log();
  console.log('--- Query Voice Data (from Finspot dashboard) ---');
  console.log();
  console.log(`  GET ${FINSPOT_APP_URL}:${WEBHOOK_PORT}/api/voice/stats`);
  console.log(`  GET ${FINSPOT_APP_URL}:${WEBHOOK_PORT}/api/voice/active-calls`);
  console.log(`  GET ${FINSPOT_APP_URL}:${WEBHOOK_PORT}/api/voice/incidents`);
  console.log(`  GET ${FINSPOT_APP_URL}:${WEBHOOK_PORT}/api/voice/call-history`);
  console.log();
}

main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
