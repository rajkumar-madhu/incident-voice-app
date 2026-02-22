-- RAG Knowledge Documents Schema
-- Requires: uuid-ossp, vector extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge documents table with vector embeddings
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    title VARCHAR(500),
    content TEXT NOT NULL,
    embedding VECTOR(384),
    metadata JSONB DEFAULT '{}',
    chunk_index INTEGER DEFAULT 0,
    parent_document_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tenant_id ON knowledge_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_parent ON knowledge_documents(parent_document_id);

-- IVFFlat index for vector similarity search
-- Note: requires at least some data before creating; use CREATE INDEX CONCURRENTLY in production
-- CREATE INDEX IF NOT EXISTS idx_knowledge_documents_embedding ON knowledge_documents
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Row Level Security
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_documents_tenant_isolation ON knowledge_documents;
CREATE POLICY knowledge_documents_tenant_isolation ON knowledge_documents
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Grant permissions
GRANT ALL ON knowledge_documents TO postgres;
