-- Webhook Secret Migration
-- Adds webhook_secret column to agents table for authenticated webhook delivery

ALTER TABLE agents ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
