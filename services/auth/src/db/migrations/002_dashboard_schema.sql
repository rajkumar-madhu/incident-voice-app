-- Dashboard Schema Migration
-- Adds call_logs, agents, phone_numbers, billing tables + materialized views

-- ============================================================
-- AGENTS table — configurable AI assistants per tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL DEFAULT 'You are a helpful voice assistant.',
    model VARCHAR(50) NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    temperature DECIMAL(3, 2) NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens INTEGER NOT NULL DEFAULT 1024 CHECK (max_tokens > 0 AND max_tokens <= 8192),
    voice_id VARCHAR(100) NOT NULL DEFAULT 'default',
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    greeting_message TEXT DEFAULT 'Hello! How can I help you today?',
    end_call_phrases TEXT[] DEFAULT ARRAY['goodbye', 'bye', 'end call'],
    enabled_tools JSONB DEFAULT '[]',
    rag_enabled BOOLEAN NOT NULL DEFAULT false,
    rag_collection_id UUID,
    webhook_url TEXT,
    webhook_events TEXT[] DEFAULT ARRAY['call.completed', 'call.failed'],
    is_active BOOLEAN NOT NULL DEFAULT true,
    total_calls INTEGER NOT NULL DEFAULT 0,
    avg_duration_seconds DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_agents_tenant_id ON agents(tenant_id);
CREATE INDEX idx_agents_is_active ON agents(is_active);
CREATE INDEX idx_agents_tenant_active ON agents(tenant_id, is_active);

CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CALL_LOGS table — persisted voice session records
-- ============================================================
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    conversation_id UUID,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'twilio', 'api', 'widget')),
    direction VARCHAR(10) NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'abandoned', 'no_answer', 'busy', 'in_progress')),
    caller_number VARCHAR(20),
    callee_number VARCHAR(20),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds DECIMAL(10, 2) DEFAULT 0,
    stt_latency_ms INTEGER,
    llm_latency_ms INTEGER,
    tts_latency_ms INTEGER,
    total_latency_ms INTEGER,
    stt_seconds DECIMAL(10, 2) DEFAULT 0,
    tts_characters INTEGER DEFAULT 0,
    llm_tokens INTEGER DEFAULT 0,
    turn_count INTEGER DEFAULT 0,
    total_cost_cents DECIMAL(10, 4) DEFAULT 0,
    transcript_summary TEXT,
    user_sentiment VARCHAR(20) CHECK (user_sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    tags TEXT[] DEFAULT '{}',
    recording_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_logs_tenant_id ON call_logs(tenant_id);
CREATE INDEX idx_call_logs_session_id ON call_logs(session_id);
CREATE INDEX idx_call_logs_agent_id ON call_logs(agent_id);
CREATE INDEX idx_call_logs_status ON call_logs(status);
CREATE INDEX idx_call_logs_channel ON call_logs(channel);
CREATE INDEX idx_call_logs_started_at ON call_logs(started_at);
CREATE INDEX idx_call_logs_tenant_started ON call_logs(tenant_id, started_at DESC);
CREATE INDEX idx_call_logs_tenant_status ON call_logs(tenant_id, status);
CREATE INDEX idx_call_logs_tenant_agent ON call_logs(tenant_id, agent_id);
CREATE INDEX idx_call_logs_transcript_search ON call_logs USING gin(to_tsvector('english', COALESCE(transcript_summary, '')));

-- ============================================================
-- PHONE_NUMBERS table — Twilio number inventory per tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS phone_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    friendly_name VARCHAR(100),
    twilio_sid VARCHAR(50),
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    capabilities TEXT[] DEFAULT ARRAY['voice'],
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'released')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phone_numbers_tenant_id ON phone_numbers(tenant_id);
CREATE INDEX idx_phone_numbers_phone ON phone_numbers(phone_number);
CREATE INDEX idx_phone_numbers_agent_id ON phone_numbers(agent_id);
CREATE INDEX idx_phone_numbers_status ON phone_numbers(status);

CREATE TRIGGER update_phone_numbers_updated_at
    BEFORE UPDATE ON phone_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- BILLING_PLANS table — pricing tiers (seeded)
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_plans (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    monthly_base_price_cents INTEGER NOT NULL DEFAULT 0,
    included_call_minutes INTEGER NOT NULL DEFAULT 0,
    included_stt_seconds INTEGER NOT NULL DEFAULT 0,
    included_tts_characters INTEGER NOT NULL DEFAULT 0,
    included_llm_tokens INTEGER NOT NULL DEFAULT 0,
    included_api_calls INTEGER NOT NULL DEFAULT 0,
    price_per_call_minute_cents DECIMAL(10, 4) NOT NULL DEFAULT 0,
    price_per_stt_second_cents DECIMAL(10, 4) NOT NULL DEFAULT 0,
    price_per_tts_1k_chars_cents DECIMAL(10, 4) NOT NULL DEFAULT 0,
    price_per_llm_1k_tokens_cents DECIMAL(10, 4) NOT NULL DEFAULT 0,
    max_agents INTEGER NOT NULL DEFAULT 1,
    max_phone_numbers INTEGER NOT NULL DEFAULT 0,
    max_concurrent_calls INTEGER NOT NULL DEFAULT 1,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed billing plans
INSERT INTO billing_plans (id, name, description, monthly_base_price_cents, included_call_minutes, included_stt_seconds, included_tts_characters, included_llm_tokens, included_api_calls, price_per_call_minute_cents, price_per_stt_second_cents, price_per_tts_1k_chars_cents, price_per_llm_1k_tokens_cents, max_agents, max_phone_numbers, max_concurrent_calls, features)
VALUES
    ('free', 'Free', 'Get started with basic voice AI capabilities', 0, 100, 6000, 100000, 500000, 1000, 2.5, 0.4, 1.5, 3.0, 1, 0, 1, '{"analytics": false, "webhooks": false, "priority_support": false}'),
    ('pro', 'Professional', 'For growing businesses with advanced features', 4900, 1000, 60000, 1000000, 5000000, 10000, 1.5, 0.25, 1.0, 2.0, 5, 3, 5, '{"analytics": true, "webhooks": true, "priority_support": false}'),
    ('enterprise', 'Enterprise', 'Custom solutions for large organizations', 19900, 10000, 600000, 10000000, 50000000, 100000, 1.0, 0.15, 0.5, 1.0, 50, 20, 50, '{"analytics": true, "webhooks": true, "priority_support": true}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- BILLING_USAGE_SUMMARIES — monthly cost summaries
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_usage_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_call_minutes DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_stt_seconds DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_tts_characters INTEGER NOT NULL DEFAULT 0,
    total_llm_tokens INTEGER NOT NULL DEFAULT 0,
    total_api_calls INTEGER NOT NULL DEFAULT 0,
    total_calls INTEGER NOT NULL DEFAULT 0,
    base_cost_cents INTEGER NOT NULL DEFAULT 0,
    overage_cost_cents DECIMAL(12, 4) NOT NULL DEFAULT 0,
    total_cost_cents DECIMAL(12, 4) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'invoiced', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, period_start)
);

CREATE INDEX idx_billing_summaries_tenant ON billing_usage_summaries(tenant_id);
CREATE INDEX idx_billing_summaries_period ON billing_usage_summaries(period_start, period_end);
CREATE INDEX idx_billing_summaries_tenant_period ON billing_usage_summaries(tenant_id, period_start DESC);

CREATE TRIGGER update_billing_summaries_updated_at
    BEFORE UPDATE ON billing_usage_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MATERIALIZED VIEWS — pre-aggregated analytics
-- ============================================================

-- Daily call stats per tenant
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_call_stats AS
SELECT
    tenant_id,
    DATE(started_at) AS call_date,
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_calls,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_calls,
    COUNT(*) FILTER (WHERE status = 'abandoned') AS abandoned_calls,
    COALESCE(AVG(duration_seconds), 0) AS avg_duration,
    COALESCE(SUM(duration_seconds), 0) AS total_duration,
    COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_seconds), 0) AS p50_duration,
    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_seconds), 0) AS p95_duration,
    COALESCE(AVG(stt_latency_ms), 0) AS avg_stt_latency,
    COALESCE(AVG(llm_latency_ms), 0) AS avg_llm_latency,
    COALESCE(AVG(tts_latency_ms), 0) AS avg_tts_latency,
    COALESCE(SUM(total_cost_cents), 0) AS total_cost_cents,
    COALESCE(SUM(stt_seconds), 0) AS total_stt_seconds,
    COALESCE(SUM(tts_characters), 0) AS total_tts_characters,
    COALESCE(SUM(llm_tokens), 0) AS total_llm_tokens,
    COUNT(*) FILTER (WHERE channel = 'web') AS web_calls,
    COUNT(*) FILTER (WHERE channel = 'twilio') AS twilio_calls,
    COUNT(*) FILTER (WHERE channel = 'api') AS api_calls,
    COUNT(*) FILTER (WHERE channel = 'widget') AS widget_calls,
    COUNT(*) FILTER (WHERE user_sentiment = 'positive') AS positive_sentiment,
    COUNT(*) FILTER (WHERE user_sentiment = 'negative') AS negative_sentiment,
    COUNT(*) FILTER (WHERE user_sentiment = 'neutral') AS neutral_sentiment
FROM call_logs
GROUP BY tenant_id, DATE(started_at);

CREATE UNIQUE INDEX idx_mv_daily_stats_tenant_date ON mv_daily_call_stats(tenant_id, call_date);

-- Hourly call volume for heatmap (day-of-week x hour-of-day)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hourly_call_volume AS
SELECT
    tenant_id,
    EXTRACT(DOW FROM started_at)::INTEGER AS day_of_week,
    EXTRACT(HOUR FROM started_at)::INTEGER AS hour_of_day,
    COUNT(*) AS call_count,
    COALESCE(AVG(duration_seconds), 0) AS avg_duration
FROM call_logs
WHERE started_at >= NOW() - INTERVAL '90 days'
GROUP BY tenant_id, EXTRACT(DOW FROM started_at), EXTRACT(HOUR FROM started_at);

CREATE UNIQUE INDEX idx_mv_hourly_volume_tenant ON mv_hourly_call_volume(tenant_id, day_of_week, hour_of_day);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_agents ON agents
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_call_logs ON call_logs
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_phone_numbers ON phone_numbers
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_billing_summaries ON billing_usage_summaries
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================
-- REFRESH FUNCTION for materialized views
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_call_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hourly_call_volume;
END;
$$ LANGUAGE plpgsql;
