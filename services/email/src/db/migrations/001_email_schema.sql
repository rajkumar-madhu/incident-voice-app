CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    email_address VARCHAR(320) NOT NULL,
    display_name VARCHAR(200),
    imap_host VARCHAR(255) NOT NULL,
    imap_port INTEGER DEFAULT 993,
    imap_secure BOOLEAN DEFAULT true,
    imap_username VARCHAR(255) NOT NULL,
    imap_password_encrypted TEXT NOT NULL,
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER DEFAULT 587,
    smtp_secure BOOLEAN DEFAULT false,
    smtp_username VARCHAR(255) NOT NULL,
    smtp_password_encrypted TEXT NOT NULL,
    ai_enabled BOOLEAN DEFAULT false,
    ai_auto_reply BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_tenant ON email_accounts(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_unique ON email_accounts(tenant_id, email_address);

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_accounts_tenant_isolation ON email_accounts
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    message_id VARCHAR(500),
    thread_id VARCHAR(500),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_address VARCHAR(320) NOT NULL,
    to_addresses JSONB DEFAULT '[]',
    cc_addresses JSONB DEFAULT '[]',
    bcc_addresses JSONB DEFAULT '[]',
    subject VARCHAR(1000),
    body_text TEXT,
    body_html TEXT,
    ai_processed BOOLEAN DEFAULT false,
    ai_draft_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_tenant ON emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY emails_tenant_isolation ON emails
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE TABLE IF NOT EXISTS email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    filename VARCHAR(500) NOT NULL,
    content_type VARCHAR(200),
    size_bytes INTEGER,
    storage_path VARCHAR(1000),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_email ON email_attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_tenant ON email_attachments(tenant_id);

ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_attachments_tenant_isolation ON email_attachments
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));
