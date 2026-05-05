import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const { Pool } = pg;

const needsSsl = (() => {
  const url = env.DATABASE_URL.toLowerCase();
  if (url.includes('sslmode=disable')) return false;
  if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
  return true;
})();

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  logger.error({ err: err.message }, 'pg pool error');
});

export type SqlValue = string | number | boolean | null | Date | object | undefined;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: SqlValue[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params as unknown[]);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: SqlValue[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params: SqlValue[] = []): Promise<number> {
  const result = await pool.query(text, params as unknown[]);
  return result.rowCount ?? 0;
}

const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === UNIQUE_VIOLATION
  );
}

export async function ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
