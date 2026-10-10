// ---- Webhook event types from voice agent ----

export type WebhookEvent =
  | 'call.started'
  | 'call.transcribed'
  | 'call.responded'
  | 'call.completed'
  | 'call.failed'
  | 'call.abandoned'
  | 'incident.created'
  | 'problem.created'
  | 'change.requested';

// Post-call webhook payload (call.completed / call.failed / call.abandoned)
export interface CallWebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  agent: {
    id: string;
    name: string;
  };
  call: {
    session_id: string;
    conversation_id: string | null;
    channel: 'web' | 'twilio' | 'api' | 'widget';
    direction: 'inbound' | 'outbound';
    status: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number;
    turn_count: number;
    transcript_summary: string | null;
    user_sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
    caller_number: string | null;
  };
  latency: {
    stt_ms: number | null;
    llm_ms: number | null;
    tts_ms: number | null;
    total_ms: number | null;
  };
  itsm?: {
    type: 'incident' | 'problem' | 'change';
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    summary: string;
    suggested_assignee?: string;
  };
  metadata: Record<string, unknown>;
}

// Live event payload (call.started / call.transcribed / call.responded)
export interface LiveWebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  agent: {
    id: string;
    name: string;
  };
  session_id: string;
  data: Record<string, unknown>;
}

// Unified type
export type WebhookPayload = CallWebhookPayload | LiveWebhookPayload;

// ---- Finspot ITSM types ----

export interface ItsmTicket {
  id: string;
  type: 'incident' | 'problem' | 'change';
  priority: string;
  category: string;
  summary: string;
  description: string;
  source: 'voice_agent';
  source_session_id: string;
  caller_number: string | null;
  agent_name: string;
  channel: string;
  created_at: string;
  status: 'open';
}

export interface LiveCallState {
  session_id: string;
  agent_name: string;
  started_at: string;
  channel: string;
  transcript: Array<{ role: 'user' | 'agent'; text: string; timestamp: string }>;
  status: 'active' | 'completed' | 'failed';
}
