import { Pool, PoolClient } from 'pg';
export declare const pool: Pool;
export declare const query: <T>(text: string, params?: unknown[]) => Promise<T[]>;
export declare const getClient: () => Promise<PoolClient>;
export declare const transaction: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
export declare const checkConnection: () => Promise<boolean>;
export declare const closePool: () => Promise<void>;
//# sourceMappingURL=postgres.d.ts.map