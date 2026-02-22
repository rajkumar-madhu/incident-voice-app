import { z } from 'zod';

export const PlanSchema = z.enum(['free', 'pro', 'enterprise']);
export type Plan = z.infer<typeof PlanSchema>;

export const RATE_LIMITS: Record<Plan, number> = {
  free: 60,
  pro: 300,
  enterprise: 1000,
};

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  conversation_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  conversation_id: z.string().uuid(),
  response: z.string(),
  tool_calls: z.array(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export interface Conversation {
  id: string;
  tenant_id: string;
  external_id?: string;
  status: 'active' | 'closed';
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  tenant_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
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
