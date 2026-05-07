import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { getEvolutionClient } from '../lib/evolution.js';
import { ping, query } from '../lib/pg.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'agente-ia-whatsapp',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/ready', async (_req, reply) => {
    const result = await ping();
    if (!result.ok) {
      return reply.code(503).send({
        status: 'unready',
        dependency: 'postgres',
        error: result.error,
        elapsed_ms: result.latencyMs,
      });
    }
    return { status: 'ready', dependency: 'postgres', elapsed_ms: result.latencyMs };
  });

  /**
   * /health/whatsapp — diagnóstico HONESTO da conexão WhatsApp.
   *
   * Diferente de /health (que só diz "tô vivo") e /health/ready (que checa
   * Postgres), esse endpoint detecta o cenário do Bug #1: Evolution
   * reporta `state: open` mas sendText falha em loop com "Connection
   * Closed" — state Baileys interno tá podre mesmo o connectionState
   * mentindo que tá tudo ok.
   *
   * Sinaliza degraded/unhealthy quando:
   *  - connectionState != 'open' → claramente desconectado
   *  - 5+ mensagens falhadas com "Connection Closed" nos últimos 5 min
   *    → state stale, precisa reset (logout + delete + bootstrap)
   */
  app.get('/health/whatsapp', async (_req, reply) => {
    if (!env.EVOLUTION_URL || !env.EVOLUTION_API_KEY) {
      return reply.code(503).send({
        status: 'unconfigured',
        reason: 'EVOLUTION_URL or EVOLUTION_API_KEY missing',
      });
    }

    const evolution = getEvolutionClient();
    const instance = env.EVOLUTION_INSTANCE;

    // 1. Estado reportado pelo Evolution (pode mentir, ver below)
    let connectionState = 'unknown';
    try {
      const cs = await evolution.connectionState(instance);
      connectionState = cs.state;
    } catch (err) {
      return reply.code(503).send({
        status: 'unhealthy',
        instance,
        connection_state: 'error',
        reason: 'failed to query connectionState',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 2. Indícios de state stale: mensagens recentes com "Connection
    //    Closed" mesmo com connectionState='open'.
    const recentFailures = await query<{
      total: number;
      sample_error: string | null;
    }>(
      `SELECT count(*)::int AS total,
              max(metadata->>'error') AS sample_error
       FROM chat_messages
       WHERE role = 'assistant'
         AND status = 'failed'
         AND created_at > now() - interval '5 minutes'
         AND metadata->>'error' ILIKE '%connection closed%'`,
      [],
    );
    const failedRecent = recentFailures[0]?.total ?? 0;
    const sampleError = recentFailures[0]?.sample_error ?? null;

    const isOpen = connectionState === 'open';
    const isDegraded = isOpen && failedRecent >= 5;
    const isUnhealthy = !isOpen;

    if (isUnhealthy) {
      return reply.code(503).send({
        status: 'unhealthy',
        instance,
        connection_state: connectionState,
        reason: 'connection_state is not "open"',
        suggestion: 'aluno precisa reescanear o QR em /qr',
      });
    }
    if (isDegraded) {
      return reply.code(503).send({
        status: 'degraded',
        instance,
        connection_state: connectionState,
        recent_send_failures: failedRecent,
        sample_error: sampleError,
        reason:
          'connectionState=open mas sendText falhou 5+ vezes nos últimos 5 min — state Baileys provavelmente stale',
        suggestion:
          'reset da instance: DELETE /instance/logout/<inst> + DELETE /instance/delete/<inst>, depois restart do service Agente',
      });
    }
    return {
      status: 'healthy',
      instance,
      connection_state: connectionState,
      recent_send_failures: failedRecent,
    };
  });
}
