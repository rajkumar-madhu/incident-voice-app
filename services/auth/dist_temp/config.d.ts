import { z } from 'zod';
declare const ConfigSchema: z.ZodObject<{
    port: z.ZodDefault<z.ZodNumber>;
    nodeEnv: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    databaseUrl: z.ZodString;
    redisUrl: z.ZodString;
    jwtSecret: z.ZodString;
    jwtExpiresIn: z.ZodDefault<z.ZodString>;
    jwtRefreshExpiresIn: z.ZodDefault<z.ZodString>;
    apiKeyHashRounds: z.ZodDefault<z.ZodNumber>;
    rateLimitFree: z.ZodDefault<z.ZodNumber>;
    rateLimitPro: z.ZodDefault<z.ZodNumber>;
    rateLimitEnterprise: z.ZodDefault<z.ZodNumber>;
    logLevel: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace"]>>;
}, "strip", z.ZodTypeAny, {
    port?: number;
    nodeEnv?: "development" | "production" | "test";
    databaseUrl?: string;
    redisUrl?: string;
    jwtSecret?: string;
    jwtExpiresIn?: string;
    jwtRefreshExpiresIn?: string;
    apiKeyHashRounds?: number;
    rateLimitFree?: number;
    rateLimitPro?: number;
    rateLimitEnterprise?: number;
    logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
}, {
    port?: number;
    nodeEnv?: "development" | "production" | "test";
    databaseUrl?: string;
    redisUrl?: string;
    jwtSecret?: string;
    jwtExpiresIn?: string;
    jwtRefreshExpiresIn?: string;
    apiKeyHashRounds?: number;
    rateLimitFree?: number;
    rateLimitPro?: number;
    rateLimitEnterprise?: number;
    logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
}>;
export declare const config: {
    port?: number;
    nodeEnv?: "development" | "production" | "test";
    databaseUrl?: string;
    redisUrl?: string;
    jwtSecret?: string;
    jwtExpiresIn?: string;
    jwtRefreshExpiresIn?: string;
    apiKeyHashRounds?: number;
    rateLimitFree?: number;
    rateLimitPro?: number;
    rateLimitEnterprise?: number;
    logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
};
export type Config = z.infer<typeof ConfigSchema>;
export {};
//# sourceMappingURL=config.d.ts.map