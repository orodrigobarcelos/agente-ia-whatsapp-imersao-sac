import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  DATABASE_URL: z.string().min(1),

  EVOLUTION_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().default('agente'),

  OPENAI_API_KEY: z.string().optional(),

  PUBLIC_URL: z.string().url().optional(),
  RAILWAY_PUBLIC_DOMAIN: z.string().optional(),

  AGENT_PROMPT_BOOTSTRAP: z.string().optional(),

  AGENT_BUFFER_SWEEPER_MS: z.coerce.number().int().positive().default(20_000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`[config] Variáveis de ambiente inválidas:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export function resolvePublicUrl(): string | null {
  if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/+$/, '');
  if (env.RAILWAY_PUBLIC_DOMAIN) return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  return null;
}
