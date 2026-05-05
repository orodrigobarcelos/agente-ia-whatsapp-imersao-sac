import type { FastifyInstance } from 'fastify';
import { ping } from '../lib/pg.js';

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
}
