import { z } from 'zod';
// ============================================================
// Agent schemas
// ============================================================
export const AgentChannelSchema = z.enum(['web', 'twilio', 'api', 'widget']);
export const CallStatusSchema = z.enum(['completed', 'failed', 'abandoned', 'no_answer', 'busy', 'in_progress']);
export const CallDirectionSchema = z.enum(['inbound', 'outbound']);
export const SentimentSchema = z.enum(['positive', 'neutral', 'negative', 'mixed']);
export const CreateAgentSchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    system_prompt: z.string().min(1).max(10000).default('You are a helpful voice assistant.'),
    model: z.string().max(50).default('claude-sonnet-4-20250514'),
    temperature: z.number().min(0).max(2).default(0.7),
    max_tokens: z.number().int().min(1).max(8192).default(1024),
    voice_id: z.string().max(100).default('default'),
    language: z.string().max(10).default('en'),
    greeting_message: z.string().max(500).optional(),
    end_call_phrases: z.array(z.string()).optional(),
    enabled_tools: z.array(z.record(z.unknown())).optional(),
    rag_enabled: z.boolean().default(false),
    rag_collection_id: z.string().uuid().optional(),
    webhook_url: z.string().url().optional(),
    webhook_events: z.array(z.string()).optional(),
    webhook_secret: z.string().optional(),
});
export const UpdateAgentSchema = CreateAgentSchema.partial();
export const AgentSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    system_prompt: z.string(),
    model: z.string(),
    temperature: z.number(),
    max_tokens: z.number(),
    voice_id: z.string(),
    language: z.string(),
    greeting_message: z.string().nullable(),
    end_call_phrases: z.array(z.string()),
    enabled_tools: z.unknown(),
    rag_enabled: z.boolean(),
    rag_collection_id: z.string().uuid().nullable(),
    webhook_url: z.string().nullable(),
    webhook_events: z.array(z.string()),
    webhook_secret: z.string().nullable(),
    is_active: z.boolean(),
    total_calls: z.number(),
    avg_duration_seconds: z.number(),
    created_at: z.date(),
    updated_at: z.date(),
});
// ============================================================
// Call log schemas
// ============================================================
export const CallLogSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    session_id: z.string(),
    conversation_id: z.string().uuid().nullable(),
    agent_id: z.string().uuid().nullable(),
    channel: AgentChannelSchema,
    direction: CallDirectionSchema,
    status: CallStatusSchema,
    caller_number: z.string().nullable(),
    callee_number: z.string().nullable(),
    started_at: z.date(),
    ended_at: z.date().nullable(),
    duration_seconds: z.number(),
    stt_latency_ms: z.number().nullable(),
    llm_latency_ms: z.number().nullable(),
    tts_latency_ms: z.number().nullable(),
    total_latency_ms: z.number().nullable(),
    stt_seconds: z.number(),
    tts_characters: z.number(),
    llm_tokens: z.number(),
    turn_count: z.number(),
    total_cost_cents: z.number(),
    transcript_summary: z.string().nullable(),
    user_sentiment: SentimentSchema.nullable(),
    tags: z.array(z.string()),
    recording_url: z.string().nullable(),
    metadata: z.record(z.unknown()),
    created_at: z.date(),
});
export const CallLogFilterSchema = z.object({
    status: CallStatusSchema.optional(),
    channel: AgentChannelSchema.optional(),
    agent_id: z.string().uuid().optional(),
    direction: CallDirectionSchema.optional(),
    sentiment: SentimentSchema.optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    duration_min: z.coerce.number().optional(),
    duration_max: z.coerce.number().optional(),
    search: z.string().optional(),
    sort_by: z.enum(['started_at', 'duration_seconds', 'total_cost_cents']).default('started_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
// Call log event published via Redis
export const CallCompletedEventSchema = z.object({
    session_id: z.string(),
    tenant_id: z.string().uuid(),
    conversation_id: z.string().uuid().optional(),
    agent_id: z.string().uuid().optional(),
    channel: AgentChannelSchema.default('web'),
    direction: CallDirectionSchema.default('inbound'),
    status: CallStatusSchema,
    caller_number: z.string().optional(),
    callee_number: z.string().optional(),
    started_at: z.string(),
    ended_at: z.string(),
    duration_seconds: z.number(),
    stt_latency_ms: z.number().optional(),
    llm_latency_ms: z.number().optional(),
    tts_latency_ms: z.number().optional(),
    stt_seconds: z.number().default(0),
    tts_characters: z.number().default(0),
    llm_tokens: z.number().default(0),
    turn_count: z.number().default(0),
    total_cost_cents: z.number().default(0),
    transcript_summary: z.string().optional(),
    user_sentiment: SentimentSchema.optional(),
    tags: z.array(z.string()).default([]),
    recording_url: z.string().optional(),
    metadata: z.record(z.unknown()).default({}),
});
// ============================================================
// Analytics schemas
// ============================================================
export const TimeIntervalSchema = z.enum(['hour', 'day', 'week']);
export const AnalyticsQuerySchema = z.object({
    interval: TimeIntervalSchema.default('day'),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    agent_id: z.string().uuid().optional(),
});
// ============================================================
// Billing schemas
// ============================================================
export const BillingPlanSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    monthly_base_price_cents: z.number(),
    included_call_minutes: z.number(),
    included_stt_seconds: z.number(),
    included_tts_characters: z.number(),
    included_llm_tokens: z.number(),
    included_api_calls: z.number(),
    price_per_call_minute_cents: z.number(),
    price_per_stt_second_cents: z.number(),
    price_per_tts_1k_chars_cents: z.number(),
    price_per_llm_1k_tokens_cents: z.number(),
    max_agents: z.number(),
    max_phone_numbers: z.number(),
    max_concurrent_calls: z.number(),
    features: z.record(z.unknown()),
});
export const BillingUsageSummarySchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    period_start: z.date(),
    period_end: z.date(),
    total_call_minutes: z.number(),
    total_stt_seconds: z.number(),
    total_tts_characters: z.number(),
    total_llm_tokens: z.number(),
    total_api_calls: z.number(),
    total_calls: z.number(),
    base_cost_cents: z.number(),
    overage_cost_cents: z.number(),
    total_cost_cents: z.number(),
    status: z.enum(['open', 'closed', 'invoiced', 'paid']),
    created_at: z.date(),
    updated_at: z.date(),
});
// ============================================================
// Phone number schemas
// ============================================================
export const CreatePhoneNumberSchema = z.object({
    phone_number: z.string().min(10).max(20),
    friendly_name: z.string().max(100).optional(),
    twilio_sid: z.string().max(50).optional(),
    agent_id: z.string().uuid().optional(),
    capabilities: z.array(z.string()).default(['voice']),
});
export const UpdatePhoneNumberSchema = z.object({
    friendly_name: z.string().max(100).optional(),
    agent_id: z.string().uuid().nullable().optional(),
    status: z.enum(['active', 'inactive', 'pending', 'released']).optional(),
});
export const PhoneNumberSchema = z.object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    phone_number: z.string(),
    friendly_name: z.string().nullable(),
    twilio_sid: z.string().nullable(),
    agent_id: z.string().uuid().nullable(),
    capabilities: z.array(z.string()),
    status: z.enum(['active', 'inactive', 'pending', 'released']),
    created_at: z.date(),
    updated_at: z.date(),
});
//# sourceMappingURL=dashboard.js.map