/**
 * Executor de tools com timeout e error handling.
 *
 * Erros NUNCA derrubam o agente. Se a tool falha, retornamos
 * `{ ok: false, error }` e o LLM decide o que falar pro cliente
 * ("não consegui consultar agora, tenta de novo").
 */
import { logger } from '../lib/logger.js';
import { getTool } from './registry.js';
import type { ToolResult } from './types.js';

/**
 * Timeout máximo de uma tool. 5 minutos.
 *
 * O webhook do Evolution já respondeu 200 lá no início do fluxo
 * (fire-and-forget no Fastify). O processamento da mensagem roda
 * async, então tool longa NÃO estoura webhook. O único limite real
 * é a paciência do cliente esperando resposta no WhatsApp — durante
 * esse tempo o agente manda presence "composing" pra mostrar que tá
 * trabalhando.
 *
 * 5 min cobre cenários de Playwright em sites lentos / com proteção
 * anti-bot que exigem retries.
 */
const TOOL_TIMEOUT_MS = 300_000;

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) {
    logger.warn({ tool: name }, 'unknown tool requested by LLM');
    return {
      ok: false,
      error: `tool '${name}' não está registrada nesse agente`,
    };
  }

  const startedAt = Date.now();
  try {
    const data = await Promise.race([
      tool.handler(args),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `tool timeout after ${TOOL_TIMEOUT_MS}ms`,
              ),
            ),
          TOOL_TIMEOUT_MS,
        ),
      ),
    ]);
    const elapsedMs = Date.now() - startedAt;
    logger.info(
      { tool: name, elapsedMs, args_keys: Object.keys(args) },
      'tool executed ok',
    );
    return { ok: true, data };
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(
      { tool: name, elapsedMs, err: message },
      'tool execution failed',
    );
    return { ok: false, error: message };
  }
}
