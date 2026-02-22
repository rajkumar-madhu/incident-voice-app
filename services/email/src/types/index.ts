import { z } from 'zod';

export const PlanSchema = z.enum(['free', 'pro', 'enterprise']);
export type Plan = z.infer<typeof PlanSchema>;

export const RATE_LIMITS: Record<Plan, number> = {
  free: 60, pro: 300, enterprise: 1000,
};

export const CreateEmailAccountSchema = z.object({
  email_address: z.string().email(),
  display_name: z.string().min(1).max(200),
  imap_host: z.string().min(1),
  imap_port: z.coerce.number().default(993),
  imap_secure: z.boolean().default(true),
  imap_username: z.string().min(1),
  imap_password: z.string().min(1),
  smtp_host: z.string().min(1),
  smtp_port: z.coerce.number().default(587),
  smtp_secure: z.boolean().default(false),
  smtp_username: z.string().min(1),
  smtp_password: z.string().min(1),
  ai_enabled: z.boolean().default(false),
  ai_auto_reply: z.boolean().default(false),
});

export type CreateEmailAccount = z.infer<typeof CreateEmailAccountSchema>;

export const UpdateEmailAccountSchema = CreateEmailAccountSchema.partial();
export type UpdateEmailAccount = z.infer<typeof UpdateEmailAccountSchema>;

export const SendEmailSchema = z.object({
  account_id: z.string().uuid(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  in_reply_to: z.string().optional(),
});

export type SendEmail = z.infer<typeof SendEmailSchema>;

export interface EmailAccount {
  id: string;
  tenant_id: string;
  email_address: string;
  display_name: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  imap_username: string;
  imap_password_encrypted: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password_encrypted: string;
  ai_enabled: boolean;
  ai_auto_reply: boolean;
  is_active: boolean;
  last_sync_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Email {
  id: string;
  tenant_id: string;
  account_id: string;
  message_id: string;
  thread_id: string | null;
  direction: 'inbound' | 'outbound';
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  body_text: string;
  body_html: string | null;
  ai_processed: boolean;
  ai_draft_response: string | null;
  created_at: Date;
}

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export interface RequestContext {
  tenant_id: string;
  user_id?: string;
  api_key_id?: string;
  scopes?: string[];
}

export interface ApiKey {
  id: string;
  tenant_id: string;
  key_hash: string;
  scopes: string[];
  is_active: boolean;
  expires_at: Date | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      context?: RequestContext;
      startTime?: number;
    }
  }
}
