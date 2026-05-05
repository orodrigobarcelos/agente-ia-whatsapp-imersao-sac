import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { execute, isUniqueViolation, query } from '../lib/pg.js';
import { loadAgentConfig } from './agent-config.js';

export interface BufferedMessage {
  id: string;
  session_id: string;
  instance: string;
  mensagem: string;
  media_type: string | null;
  transcription: string | null;
  created_at: string;
}

export interface AddToBufferInput {
  sessionId: string;
  instance: string;
  agentType: string;
  text: string;
  evolutionMessageId: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  transcription: string | null;
  leadPhone: string;
}

type FlushHandler = (sessionId: string) => Promise<void>;

interface PendingFlush {
  timer: NodeJS.Timeout;
}

const pending = new Map<string, PendingFlush>();
const inflight = new Map<string, Promise<void>>();
let sweeperHandle: NodeJS.Timeout | null = null;
let sweepInProgress = false;
let flushHandler: FlushHandler | null = null;

const DEFAULT_DEBOUNCE_MS = 15_000;

export function registerFlushHandler(handler: FlushHandler) {
  flushHandler = handler;
}

export async function addToBuffer(input: AddToBufferInput): Promise<void> {
  try {
    await execute(
      `INSERT INTO message_buffer
         (lead_phone, session_id, instance, mensagem, evolution_message_id,
          media_type, media_url, transcription)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.leadPhone,
        input.sessionId,
        input.instance,
        input.text,
        input.evolutionMessageId,
        input.mediaType,
        input.mediaUrl,
        input.transcription,
      ],
    );
  } catch (err) {
    if (isUniqueViolation(err)) {
      logger.debug(
        { session_id: input.sessionId, evolution_message_id: input.evolutionMessageId },
        'buffer insert skipped (duplicate evolution_message_id)',
      );
      return;
    }
    throw new Error(
      `buffer insert failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let debounceMs = DEFAULT_DEBOUNCE_MS;
  try {
    const config = await loadAgentConfig(input.agentType);
    debounceMs = config.debounce_ms;
  } catch (err) {
    logger.warn(
      {
        err: err instanceof Error ? err.message : String(err),
        agent_type: input.agentType,
      },
      'loadAgentConfig failed for debounce; using default',
    );
  }

  scheduleFlush(input.sessionId, debounceMs);
}

function scheduleFlush(sessionId: string, debounceMs: number) {
  const existing = pending.get(sessionId);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pending.delete(sessionId);
    void safeFlush(sessionId, 'debounce');
  }, debounceMs);

  pending.set(sessionId, { timer });
}

async function safeFlush(sessionId: string, trigger: 'debounce' | 'sweeper') {
  if (!flushHandler) {
    logger.error(
      { session_id: sessionId },
      'flush requested but no handler registered',
    );
    return;
  }
  if (inflight.has(sessionId)) {
    logger.debug({ session_id: sessionId, trigger }, 'flush already inflight, skipping');
    return;
  }
  const promise = (async () => {
    try {
      await flushHandler!(sessionId);
    } catch (err) {
      logger.error({ err, session_id: sessionId, trigger }, 'flush handler threw');
    } finally {
      inflight.delete(sessionId);
    }
  })();
  inflight.set(sessionId, promise);
  await promise;
}

export async function peekPendingBuffer(
  sessionId: string,
): Promise<BufferedMessage[]> {
  return query<BufferedMessage>(
    `SELECT id, session_id, instance, mensagem, media_type, transcription, created_at
     FROM message_buffer
     WHERE session_id = $1 AND processed_at IS NULL
     ORDER BY created_at ASC`,
    [sessionId],
  );
}

export async function markBufferProcessed(rowIds: string[]): Promise<number> {
  if (rowIds.length === 0) return 0;
  const result = await query<{ id: string }>(
    `UPDATE message_buffer
     SET processed_at = now()
     WHERE id = ANY($1::uuid[]) AND processed_at IS NULL
     RETURNING id`,
    [rowIds],
  );
  return result.length;
}

export function startBufferSweeper(): void {
  if (sweeperHandle) return;
  const interval = env.AGENT_BUFFER_SWEEPER_MS;
  sweeperHandle = setInterval(() => {
    if (sweepInProgress) {
      logger.debug('sweeper tick skipped (previous tick still running)');
      return;
    }
    sweepInProgress = true;
    sweepStrandedBuffers()
      .catch((err) => {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'sweepStrandedBuffers threw',
        );
      })
      .finally(() => {
        sweepInProgress = false;
      });
  }, interval);
  logger.info({ interval_ms: interval }, 'buffer sweeper started');
}

export function stopBufferSweeper(): void {
  if (sweeperHandle) {
    clearInterval(sweeperHandle);
    sweeperHandle = null;
  }
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
}

export async function awaitInflightFlushes(timeoutMs = 30_000): Promise<void> {
  const promises = Array.from(inflight.values());
  if (promises.length === 0) return;
  logger.info({ count: promises.length }, 'waiting for inflight flushes to finish');
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([Promise.allSettled(promises), timeout]);
  const remaining = inflight.size;
  if (remaining > 0) {
    logger.warn({ remaining }, 'inflight flushes still running after timeout');
  } else {
    logger.info('all inflight flushes settled');
  }
}

async function detectZombieAssistantMessages(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 120_000).toISOString();
    const rows = await query<{ id: string; session_id: string }>(
      `UPDATE chat_messages
       SET status = 'failed',
           metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{error}',
                                 '"zombie: pending for >120s"', true)
       WHERE role = 'assistant' AND status = 'pending' AND created_at < $1
       RETURNING id, session_id`,
      [cutoff],
    );
    if (rows.length > 0) {
      logger.warn(
        { count: rows.length, zombies: rows },
        'zombie assistant messages detected and marked as failed',
      );
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'zombie detector query failed',
    );
  }
}

async function sweepStrandedBuffers(): Promise<void> {
  await detectZombieAssistantMessages();

  const cutoff = new Date(Date.now() - DEFAULT_DEBOUNCE_MS - 5_000).toISOString();
  const rows = await query<{ session_id: string }>(
    `SELECT DISTINCT session_id
     FROM message_buffer
     WHERE processed_at IS NULL AND created_at < $1`,
    [cutoff],
  );

  const sessions = new Set<string>();
  for (const row of rows) {
    if (
      row.session_id &&
      !pending.has(row.session_id) &&
      !inflight.has(row.session_id)
    ) {
      sessions.add(row.session_id);
    }
  }

  for (const sessionId of sessions) {
    logger.info({ session_id: sessionId }, 'sweeper triggering stranded flush');
    void safeFlush(sessionId, 'sweeper');
  }
}
