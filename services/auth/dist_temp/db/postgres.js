import { Pool } from 'pg';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
export const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected error on idle client');
});
pool.on('connect', () => {
    logger.debug('New client connected to PostgreSQL');
});
export const query = async (text, params) => {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({
        query: text,
        duration,
        rows: result.rowCount,
    }, 'Executed query');
    return result.rows;
};
export const getClient = async () => {
    return pool.connect();
};
export const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
};
export const checkConnection = async () => {
    try {
        await pool.query('SELECT 1');
        return true;
    }
    catch {
        return false;
    }
};
export const closePool = async () => {
    await pool.end();
    logger.info('PostgreSQL pool closed');
};
//# sourceMappingURL=postgres.js.map