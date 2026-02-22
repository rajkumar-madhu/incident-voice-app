export interface VoiceSession {
  id: string;
  tenantId: string;
  userId?: string;
  apiKeyId?: string;
  conversationId?: string;
  status: 'active' | 'processing' | 'closed';
  createdAt: number;
  lastActivityAt: number;
  metadata: Record<string, unknown>;
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  sampleRate: number;
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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      context?: RequestContext;
      startTime?: number;
    }
  }
}
