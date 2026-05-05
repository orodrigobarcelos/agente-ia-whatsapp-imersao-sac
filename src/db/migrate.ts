/**
 * Migrate idempotente: roda no boot do container (npm run boot).
 * - Aplica schema.sql (CREATE IF NOT EXISTS, DROP+CREATE TRIGGER, CREATE OR REPLACE FUNCTION).
 * - Faz bootstrap da linha 'default' em agent_configs se a tabela estiver vazia,
 *   usando AGENT_PROMPT_BOOTSTRAP (env var) ou um prompt placeholder.
 *
 * Roda separado do server.ts pra falhar cedo se o banco não estiver acessível.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { execute, pool, queryOne } from '../lib/pg.js';

const PLACEHOLDER_PROMPT = `Você é um assistente conversacional de WhatsApp.

Esta é uma configuração placeholder — substitua pelo prompt real do seu agente
via Claude Code + MCP Postgres:

  UPDATE agent_configs SET system_prompt = '...' WHERE agent_type = 'default';

Enquanto não for atualizado, responda apenas:
"oi! ainda estou sendo configurado, volto já já"`;

async function loadSchemaSql(): Promise<string> {
  // Em produção (Docker), schema.sql é copiado pra dist/db/schema.sql.
  // Em dev, fica em src/db/schema.sql relativo a este arquivo.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, 'schema.sql'),
    resolve(here, '../../src/db/schema.sql'),
    resolve(process.cwd(), 'src/db/schema.sql'),
    resolve(process.cwd(), 'dist/db/schema.sql'),
  ];
  for (const path of candidates) {
    try {
      return await readFile(path, 'utf-8');
    } catch {
      // try next
    }
  }
  throw new Error(
    `schema.sql not found in any of: ${candidates.join(', ')}`,
  );
}

async function applySchema(): Promise<void> {
  const sql = await loadSchemaSql();
  logger.info({ size_bytes: sql.length }, 'applying schema.sql');
  await pool.query(sql);
  logger.info('schema.sql applied');
}

async function bootstrapAgentConfig(): Promise<void> {
  const existing = await queryOne<{ agent_type: string }>(
    `SELECT agent_type FROM agent_configs WHERE agent_type = $1`,
    ['default'],
  );
  if (existing) {
    logger.info('agent_configs.default already exists, skipping bootstrap');
    return;
  }

  const prompt = env.AGENT_PROMPT_BOOTSTRAP?.trim() || PLACEHOLDER_PROMPT;
  await execute(
    `INSERT INTO agent_configs (
      agent_type, enabled, system_prompt, openai_model,
      debounce_ms, typing_ms, inter_message_delay_ms,
      history_limit, max_output_messages
    ) VALUES ($1, true, $2, 'gpt-4.1-mini', 15000, 1000, 1000, 30, 5)`,
    ['default', prompt],
  );
  logger.info(
    { used_bootstrap_env: !!env.AGENT_PROMPT_BOOTSTRAP },
    'agent_configs.default bootstrapped',
  );
}

async function main(): Promise<void> {
  try {
    await applySchema();
    await bootstrapAgentConfig();
    logger.info('migrate completed');
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'migrate failed',
    );
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

void main();
