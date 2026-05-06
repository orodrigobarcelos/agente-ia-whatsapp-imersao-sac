/**
 * Registry global de tools.
 *
 * Tools registram-se via side-effect: cada arquivo de tool importa esse
 * módulo e chama `registerTool({...})` no top-level. O `tools/index.ts`
 * faz o auto-import de todos os arquivos pra disparar os registros.
 *
 * Ordem de import não importa — o Map global agrega tudo.
 */
import { logger } from '../lib/logger.js';
import type { ToolDefinition } from './types.js';

const tools = new Map<string, ToolDefinition>();

export function registerTool(def: ToolDefinition): void {
  if (!def.name || typeof def.name !== 'string') {
    throw new Error(
      `invalid tool definition: name must be a non-empty string (got ${JSON.stringify(def.name)})`,
    );
  }
  if (typeof def.handler !== 'function') {
    throw new Error(`invalid tool '${def.name}': handler must be a function`);
  }
  if (tools.has(def.name)) {
    logger.warn(
      { tool: def.name },
      'tool already registered, overwriting (last import wins)',
    );
  }
  tools.set(def.name, def);
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return [...tools.values()];
}

/**
 * Converte o registry pro formato que o OpenAI Chat Completions espera
 * em `tools: [...]`. Strict mode habilitado pra garantir que args batem
 * com o JSON Schema.
 */
export function getOpenAIToolSpecs(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolDefinition['parameters'];
    strict: boolean;
  };
}> {
  return getAllTools().map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      strict: true,
    },
  }));
}

/**
 * Útil pra testes — limpa o registry. Não usar em produção.
 */
export function clearRegistry(): void {
  tools.clear();
}
