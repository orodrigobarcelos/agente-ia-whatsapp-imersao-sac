import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { queryOne } from '../lib/pg.js';

export interface AgentConfig {
  agent_type: string;
  enabled: boolean;
  openai_api_key: string | null;
  openai_model: string;
  system_prompt: string;
  debounce_ms: number;
  typing_ms: number;
  inter_message_delay_ms: number;
  history_limit: number;
  max_output_messages: number;
  updated_at: string;
}

interface CacheEntry {
  config: AgentConfig;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

export async function loadAgentConfig(agentType: string): Promise<AgentConfig> {
  const now = Date.now();
  const cached = cache.get(agentType);
  if (cached && cached.expiresAt > now) return cached.config;

  const row = await queryOne<AgentConfig>(
    `SELECT
       agent_type, enabled, openai_api_key, openai_model, system_prompt,
       debounce_ms, typing_ms, inter_message_delay_ms,
       history_limit, max_output_messages, updated_at
     FROM agent_configs
     WHERE agent_type = $1`,
    [agentType],
  );
  if (!row) {
    throw new Error(`agent_config not found for agent_type='${agentType}'`);
  }

  cache.set(agentType, { config: row, expiresAt: now + CACHE_TTL_MS });
  return row;
}

export function invalidateAgentConfigCache(agentType?: string): void {
  if (agentType) cache.delete(agentType);
  else cache.clear();
}

export function resolveOpenAIKey(config: AgentConfig): string {
  const fromConfig = config.openai_api_key?.trim();
  if (fromConfig) return fromConfig;
  const fromEnv = env.OPENAI_API_KEY?.trim();
  if (fromEnv) {
    logger.debug(
      { agent_type: config.agent_type },
      'falling back to env OPENAI_API_KEY (agent_configs.openai_api_key empty)',
    );
    return fromEnv;
  }
  throw new Error(
    `no OpenAI key available (agent_configs.openai_api_key empty and OPENAI_API_KEY env not set) for agent_type=${config.agent_type}`,
  );
}
