import { pino } from 'pino';
import type {
  CallWebhookPayload,
  LiveWebhookPayload,
  WebhookEvent,
  ItsmTicket,
  LiveCallState,
} from './types.js';

const logger = pino({ level: 'info' });

// ---- In-memory stores (replace with your DB in production) ----

// Live calls currently in progress
const activeCalls = new Map<string, LiveCallState>();

// ITSM tickets created from voice calls
const itsmTickets: ItsmTicket[] = [];

// Call history
const callHistory: CallWebhookPayload[] = [];

// ---- Getters for the API ----

export const getActiveCalls = (): LiveCallState[] =>
  Array.from(activeCalls.values()).filter(c => c.status === 'active');

export const getItsmTickets = (): ItsmTicket[] => itsmTickets;

export const getCallHistory = (limit = 50): CallWebhookPayload[] =>
  callHistory.slice(-limit).reverse();

export const getStats = () => ({
  active_calls: getActiveCalls().length,
  total_calls: callHistory.length,
  incidents: itsmTickets.filter(t => t.type === 'incident').length,
  problems: itsmTickets.filter(t => t.type === 'problem').length,
  changes: itsmTickets.filter(t => t.type === 'change').length,
  avg_duration: callHistory.length > 0
    ? Math.round(callHistory.reduce((sum, c) => sum + c.call.duration_seconds, 0) / callHistory.length)
    : 0,
});

// ---- Event Handlers ----

export const handleWebhook = (event: WebhookEvent, payload: CallWebhookPayload | LiveWebhookPayload): void => {
  logger.info({ event, sessionId: getSessionId(payload) }, 'Webhook received');

  switch (event) {
    // ---- Live events (during call) ----
    case 'call.started':
      handleCallStarted(payload as LiveWebhookPayload);
      break;
    case 'call.transcribed':
      handleCallTranscribed(payload as LiveWebhookPayload);
      break;
    case 'call.responded':
      handleCallResponded(payload as LiveWebhookPayload);
      break;

    // ---- Post-call events ----
    case 'call.completed':
      handleCallCompleted(payload as CallWebhookPayload);
      break;
    case 'call.failed':
      handleCallFailed(payload as CallWebhookPayload);
      break;
    case 'call.abandoned':
      handleCallAbandoned(payload as CallWebhookPayload);
      break;

    // ---- ITSM events ----
    case 'incident.created':
      handleIncident(payload as CallWebhookPayload);
      break;
    case 'problem.created':
      handleProblem(payload as CallWebhookPayload);
      break;
    case 'change.requested':
      handleChange(payload as CallWebhookPayload);
      break;

    default:
      logger.warn({ event }, 'Unknown webhook event');
  }
};

// ---- Live call handlers ----

function handleCallStarted(payload: LiveWebhookPayload): void {
  const state: LiveCallState = {
    session_id: payload.session_id,
    agent_name: payload.agent.name,
    started_at: payload.timestamp,
    channel: (payload.data.channel as string) || 'web',
    transcript: [],
    status: 'active',
  };
  activeCalls.set(payload.session_id, state);

  logger.info({
    session_id: payload.session_id,
    agent: payload.agent.name,
    channel: state.channel,
  }, '>>> CALL STARTED - Live monitoring active');

  // TODO: Push to your real-time dashboard via SSE/WebSocket
  // e.g., io.emit('call:started', state);
}

function handleCallTranscribed(payload: LiveWebhookPayload): void {
  const call = activeCalls.get(payload.session_id);
  if (call) {
    call.transcript.push({
      role: 'user',
      text: payload.data.text as string,
      timestamp: payload.timestamp,
    });
  }

  logger.info({
    session_id: payload.session_id,
    text: payload.data.text,
    confidence: payload.data.confidence,
  }, '>>> USER SAID (live transcript)');

  // TODO: Push to live dashboard
  // e.g., io.emit('call:transcript', { session_id, role: 'user', text });
}

function handleCallResponded(payload: LiveWebhookPayload): void {
  const call = activeCalls.get(payload.session_id);
  if (call) {
    call.transcript.push({
      role: 'agent',
      text: payload.data.text as string,
      timestamp: payload.timestamp,
    });
  }

  logger.info({
    session_id: payload.session_id,
    text: payload.data.text,
  }, '>>> AGENT RESPONDED (live)');

  // TODO: Push to live dashboard
  // e.g., io.emit('call:response', { session_id, role: 'agent', text });
}

// ---- Post-call handlers ----

function handleCallCompleted(payload: CallWebhookPayload): void {
  callHistory.push(payload);

  // Mark as completed in active calls
  const call = activeCalls.get(payload.call.session_id);
  if (call) {
    call.status = 'completed';
    // Keep for 5 minutes then clean up
    setTimeout(() => activeCalls.delete(payload.call.session_id), 5 * 60 * 1000);
  }

  logger.info({
    session_id: payload.call.session_id,
    duration: payload.call.duration_seconds,
    turns: payload.call.turn_count,
    sentiment: payload.call.user_sentiment,
    channel: payload.call.channel,
    latency: payload.latency.total_ms,
  }, '<<< CALL COMPLETED');

  // TODO: Update CRM, billing, analytics
  // e.g., await db.callLogs.insert(payload);
  // e.g., await crm.updateContact(payload.call.caller_number, { lastCall: payload });
}

function handleCallFailed(payload: CallWebhookPayload): void {
  callHistory.push(payload);

  const call = activeCalls.get(payload.call.session_id);
  if (call) call.status = 'failed';

  logger.error({
    session_id: payload.call.session_id,
    channel: payload.call.channel,
    duration: payload.call.duration_seconds,
  }, '!!! CALL FAILED');

  // TODO: Alert on-call team, create incident
  // e.g., await alerting.notify('voice-call-failed', payload);
}

function handleCallAbandoned(payload: CallWebhookPayload): void {
  callHistory.push(payload);
  activeCalls.delete(payload.call.session_id);

  logger.warn({
    session_id: payload.call.session_id,
    duration: payload.call.duration_seconds,
    channel: payload.call.channel,
  }, '--- CALL ABANDONED');

  // TODO: Add to follow-up queue
  // e.g., await followUpQueue.add({ caller: payload.call.caller_number, reason: 'abandoned' });
}

// ---- ITSM handlers ----

function handleIncident(payload: CallWebhookPayload): void {
  if (!payload.itsm) return;

  const ticket: ItsmTicket = {
    id: `INC-${Date.now()}`,
    type: 'incident',
    priority: payload.itsm.priority,
    category: payload.itsm.category,
    summary: payload.itsm.summary,
    description: buildTicketDescription(payload),
    source: 'voice_agent',
    source_session_id: payload.call.session_id,
    caller_number: payload.call.caller_number,
    agent_name: payload.agent.name,
    channel: payload.call.channel,
    created_at: payload.timestamp,
    status: 'open',
  };
  itsmTickets.push(ticket);

  logger.warn({
    ticket_id: ticket.id,
    priority: ticket.priority,
    category: ticket.category,
    summary: ticket.summary,
    caller: ticket.caller_number,
  }, '🔴 INCIDENT CREATED from voice call');

  // TODO: Create in your ITSM system
  // e.g., await finspotApi.incidents.create(ticket);
  // e.g., if (ticket.priority === 'critical') await pagerDuty.trigger(ticket);
}

function handleProblem(payload: CallWebhookPayload): void {
  if (!payload.itsm) return;

  const ticket: ItsmTicket = {
    id: `PRB-${Date.now()}`,
    type: 'problem',
    priority: payload.itsm.priority,
    category: payload.itsm.category,
    summary: payload.itsm.summary,
    description: buildTicketDescription(payload),
    source: 'voice_agent',
    source_session_id: payload.call.session_id,
    caller_number: payload.call.caller_number,
    agent_name: payload.agent.name,
    channel: payload.call.channel,
    created_at: payload.timestamp,
    status: 'open',
  };
  itsmTickets.push(ticket);

  logger.warn({
    ticket_id: ticket.id,
    priority: ticket.priority,
    summary: ticket.summary,
  }, '🟡 PROBLEM RECORD CREATED from voice call');

  // TODO: Create in your ITSM system
  // e.g., await finspotApi.problems.create(ticket);
}

function handleChange(payload: CallWebhookPayload): void {
  if (!payload.itsm) return;

  const ticket: ItsmTicket = {
    id: `CHG-${Date.now()}`,
    type: 'change',
    priority: payload.itsm.priority,
    category: payload.itsm.category,
    summary: payload.itsm.summary,
    description: buildTicketDescription(payload),
    source: 'voice_agent',
    source_session_id: payload.call.session_id,
    caller_number: payload.call.caller_number,
    agent_name: payload.agent.name,
    channel: payload.call.channel,
    created_at: payload.timestamp,
    status: 'open',
  };
  itsmTickets.push(ticket);

  logger.info({
    ticket_id: ticket.id,
    summary: ticket.summary,
  }, '🔵 CHANGE REQUEST CREATED from voice call');

  // TODO: Create in your ITSM system
  // e.g., await finspotApi.changes.create(ticket);
}

// ---- Helpers ----

function getSessionId(payload: CallWebhookPayload | LiveWebhookPayload): string {
  return 'call' in payload ? payload.call.session_id : payload.session_id;
}

function buildTicketDescription(payload: CallWebhookPayload): string {
  const call = payload.call || {} as CallWebhookPayload['call'];
  const latency = payload.latency;
  const lines = [
    `Source: Voice call via ${call.channel || 'unknown'}`,
    `Agent: ${payload.agent?.name || 'Unknown'}`,
    `Caller: ${call.caller_number || 'Unknown'}`,
    `Duration: ${call.duration_seconds ?? 0}s (${call.turn_count ?? 0} turns)`,
    `Sentiment: ${call.user_sentiment || 'Unknown'}`,
    '',
    'Transcript Summary:',
    call.transcript_summary || '(none)',
    '',
    ...(latency
      ? [`Latency: STT ${latency.stt_ms}ms | LLM ${latency.llm_ms}ms | TTS ${latency.tts_ms}ms`]
      : []),
    `Session: ${call.session_id}`,
  ];
  return lines.join('\n');
}
