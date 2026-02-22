-- Orchestrator Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    external_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_external_id ON conversations(tenant_id, external_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_tenant_isolation ON conversations
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_tenant ON conversation_messages(tenant_id);

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_messages_tenant_isolation ON conversation_messages
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));
