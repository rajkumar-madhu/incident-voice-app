import { z } from 'zod';

// Plan types
export const PlanSchema = z.enum(['free', 'pro', 'enterprise']);
export type Plan = z.infer<typeof PlanSchema>;

// Tenant schemas
export const CreateTenantSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  plan: PlanSchema.default('free'),
  settings: z.record(z.unknown()).optional(),
});

export const UpdateTenantSchema = CreateTenantSchema.partial();

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  plan: PlanSchema,
  settings: z.record(z.unknown()).nullable(),
  is_active: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type CreateTenant = z.infer<typeof CreateTenantSchema>;
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;
export type Tenant = z.infer<typeof TenantSchema>;

// User schemas
export const CreateUserSchema = z.object({
  tenant_id: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'user', 'viewer']).default('user'),
});

// Public sign-up: creates an organisation and its first admin. The role and
// tenant are decided by the server, so the schema does not accept them.
export const SignupSchema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
});

export type Signup = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string(),
  tenant_id: z.string().uuid().optional(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['admin', 'user', 'viewer']),
  is_active: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type User = z.infer<typeof UserSchema>;

// API Key schemas
export const CreateApiKeySchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(2).max(100),
  scopes: z.array(z.string()).default(['read', 'write']),
  expires_at: z.date().optional(),
});

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  key_prefix: z.string(),
  key_hash: z.string(),
  scopes: z.array(z.string()),
  is_active: z.boolean(),
  last_used_at: z.date().nullable(),
  expires_at: z.date().nullable(),
  created_at: z.date(),
});

export type CreateApiKey = z.infer<typeof CreateApiKeySchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;

// JWT payload
export interface JwtPayload {
  sub: string; // user_id
  tenant_id: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

// Request context
export interface RequestContext {
  tenant_id: string;
  user_id?: string;
  api_key_id?: string;
  scopes?: string[];
}

// Express extensions
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      context?: RequestContext;
      startTime?: number;
    }
  }
}

// Usage metrics
export const UsageEventSchema = z.object({
  tenant_id: z.string().uuid(),
  event_type: z.enum([
    'api_call',
    'stt_seconds',
    'tts_chars',
    'llm_tokens',
    'call_minutes',
  ]),
  value: z.number().positive(),
  metadata: z.record(z.unknown()).optional(),
});

export type UsageEvent = z.infer<typeof UsageEventSchema>;

// Rate limit config per plan
export const RATE_LIMITS: Record<Plan, number> = {
  free: 60,
  pro: 300,
  enterprise: 1000,
};
