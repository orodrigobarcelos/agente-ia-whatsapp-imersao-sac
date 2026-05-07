import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { closePool } from './lib/pg.js';
import { healthRoutes } from './routes/health.js';
import { qrRoutes } from './routes/qr.js';
import { evolutionWebhookRoutes } from './routes/webhooks/evolution.js';
import { initChatbot } from './services/chatbot.js';
import {
  awaitInflightFlushes,
  startBufferSweeper,
  stopBufferSweeper,
} from './services/buffer.js';
import {
  bootstrapEvolution,
  startEvolutionJanitor,
  stopEvolutionJanitor,
} from './services/evolution-bootstrap.js';

async function main() {
  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    bodyLimit: 5 * 1024 * 1024,
  });

  await app.register(sensible);
  await app.register(healthRoutes);
  await app.register(qrRoutes);
  await app.register(evolutionWebhookRoutes);

  initChatbot();
  startBufferSweeper();

  try {
    const address = await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info({ address, env: env.NODE_ENV }, 'server listening');
  } catch (err) {
    logger.error({ err }, 'failed to start server');
    process.exit(1);
  }

  // Bootstrap Evolution depois que o servidor já está aceitando conexões —
  // o webhook precisa que a porta esteja aberta antes de a Evolution registrá-lo.
  void bootstrapEvolution()
    .catch((err) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'evolution bootstrap threw',
      );
    })
    .finally(() => {
      // Janitor periódico que recria a instance se ela for deletada
      // externamente (ex: operador rodou DELETE /instance/delete pra
      // resetar state Baileys podre). Sem ele, Agente fica "órfão" até
      // restart manual. Só inicia depois do bootstrap inicial pra evitar
      // race com a primeira tentativa de criação.
      startEvolutionJanitor();
    });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutdown signal received');
    try {
      await app.close();
      await stopEvolutionJanitor();
      stopBufferSweeper();
      await awaitInflightFlushes(25_000);
      await closePool();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
