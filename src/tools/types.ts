/**
 * Tipos do sistema de tools (function calling) do agente.
 *
 * Tool = função TypeScript que o LLM pode invocar durante a conversa pra
 * executar uma ação real (consultar API, fazer scraping, calcular, etc).
 *
 * Diferente de "skills" (que são markdown texto no system prompt), tools
 * EXECUTAM código de verdade.
 */
import type OpenAI from 'openai';

/**
 * JSON Schema dos argumentos da tool. Usa o tipo da OpenAI (Record genérico)
 * pra ficar compatível com `tools[].function.parameters`.
 *
 * Forma esperada na prática:
 *   {
 *     type: 'object',
 *     properties: { ... },
 *     required: [...],
 *     additionalProperties: false,
 *   }
 */
export type ToolParameters = OpenAI.FunctionParameters;

export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<unknown>;

export interface ToolDefinition {
  /** Nome único da tool. Snake_case. Ex: `consultar_preco`. */
  name: string;
  /**
   * Descrição que o LLM vê pra decidir quando chamar.
   * Quanto mais clara, melhor o LLM acerta o momento certo de usar.
   */
  description: string;
  /** JSON Schema dos argumentos que a tool aceita. */
  parameters: ToolParameters;
  /** Função que executa de fato. Recebe args validados pelo OpenAI. */
  handler: ToolHandler;
}

/**
 * Resultado de execução de uma tool — sempre serializável em JSON
 * pra mandar de volta pro LLM como tool message.
 */
export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}
