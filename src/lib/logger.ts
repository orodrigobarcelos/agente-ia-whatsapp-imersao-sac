import pino from 'pino';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'agente-ia-whatsapp' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-app-secret"]',
      'req.headers.apikey',
      '*.DATABASE_URL',
      '*.OPENAI_API_KEY',
      '*.EVOLUTION_API_KEY',
    ],
    censor: '[REDACTED]',
  },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,service',
      },
    },
  }),
});
