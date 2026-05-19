import OpenAI from 'openai';
import { logger } from '../lib/logger.js';
import { getOpenAIClient } from '../lib/openai.js';
import { query } from '../lib/pg.js';
import { executeTool, getOpenAIToolSpecs } from '../tools/index.js';
import {
  loadAgentConfig,
  resolveOpenAIKey,
  type AgentConfig,
} from './agent-config.js';
import { buildSkillsBlockFor } from './skills.js';

type ChatMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export const MEDIA_FALLBACK =
  'oi, ainda não consigo ouvir áudios ou ver imagens por aqui, pode me escrever em texto?';

const RESPONSE_SCHEMA = {
  name: 'assistant_reply',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      mensagens: {
        type: 'array',
        description:
          'Lista de mensagens separadas que serão enviadas SEQUENCIALMENTE no WhatsApp, simulando como um humano digita em pedaços. ' +
          'OBRIGATÓRIO dividir em 2-5 mensagens curtas — NUNCA retornar uma única string longa. ' +
          'Cada item do array vira UMA mensagem separada no chat. ' +
          'Quebra natural recomendada: confirmação/saudação na 1ª, próximo passo/explicação na 2ª, CTA/link/pergunta na 3ª. ' +
          'Mesmo respostas curtas devem virar 2 mensagens (ex: "perfeito!" + "vou te enviar agora"). ' +
          'NÃO é um array de parágrafos — é um array de MENSAGENS DE WHATSAPP.',
        items: {
          type: 'string',
          minLength: 1,
          description:
            'Texto de UMA mensagem isolada de WhatsApp. Máximo 1-3 linhas (frases curtas, fôlego natural). ' +
            'Sem markdown (sem **, sem -, sem #). No máximo 1 emoji. ' +
            'Não comece com cumprimento se não for a primeira mensagem da conversa.',
        },
        minItems: 2,
        maxItems: 5,
      },
    },
    required: ['mensagens'],
    additionalProperties: false,
  },
} as const;

/**
 * Limite de rounds de tool calling antes de forçar resposta final.
 * Cada round = 1 chamada OpenAI + execução de tools pedidas.
 * 3 rounds cobre cenários típicos (ex: consulta + cálculo + resposta).
 */
const MAX_TOOL_ROUNDS = 3;

export interface AgentReply {
  mensagens: string[];
  model: string;
  tokens_in: number;
  tokens_out: number;
  /** Quantos rounds de tool calling foram usados (0 = nenhuma tool chamada). */
  tool_rounds: number;
}

export interface RunAgentInput {
  agentType: string;
  sessionId: string;
  userText: string;
  config?: AgentConfig;
}

interface HistoryRow {
  role: string;
  content: string;
  created_at: string;
}

async function loadHistory(
  sessionId: string,
  limit: number,
): Promise<HistoryRow[]> {
  try {
    const rows = await query<HistoryRow>(
      `SELECT role, content, created_at
       FROM chat_messages
       WHERE session_id = $1 AND role IN ('user', 'assistant')
       ORDER BY created_at DESC
       LIMIT $2`,
      [sessionId, limit],
    );
    return rows.reverse();
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), session_id: sessionId },
      'history load failed',
    );
    return [];
  }
}

/**
 * Bloco de contexto temporal injetado no topo do system prompt a cada
 * requisição. Sem isso, o LLM CHUTA o ano quando o cliente diz uma data
 * sem ano ("27 de maio") — e costuma chutar um ano do passado, o que
 * quebra qualquer tool que receba datas (ex: cotação com data passada
 * que o site recusa). Com a data de hoje explícita, o modelo preenche o
 * ano certo sem depender de chamar a tool current_time.
 */
function currentDateContext(): string {
  const now = new Date();
  const TZ = 'America/Sao_Paulo';
  const extenso = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(now);
  // en-CA formata como AAAA-MM-DD
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return [
    'CONTEXTO TEMPORAL (use SEMPRE que lidar com datas):',
    `- Hoje é ${extenso}.`,
    `- Data de hoje no formato AAAA-MM-DD: ${iso}.`,
    '- Se o cliente disser uma data sem o ano (ex: "27 de maio"), use o',
    '  ANO ATUAL. Se essa data já passou neste ano, use o próximo ano.',
    '- NUNCA use um ano do passado em datas que você preencher.',
  ].join('\n');
}

async function buildSystemMessage(config: AgentConfig): Promise<string> {
  const dateCtx = currentDateContext();
  const skillsBlock = await buildSkillsBlockFor(config.agent_type);
  const base = skillsBlock
    ? `${config.system_prompt}\n\n${skillsBlock}`
    : config.system_prompt;
  return `${dateCtx}\n\n${base}`;
}

/**
 * Executa todas as tool calls solicitadas pelo LLM em paralelo,
 * acumula resultados como tool messages e devolve pra continuar o loop.
 */
async function runToolCalls(
  toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
): Promise<ChatMsg[]> {
  const results = await Promise.all(
    toolCalls.map(async (call) => {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = call.function.arguments
          ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
          : {};
      } catch (err) {
        logger.warn(
          {
            tool: call.function.name,
            raw_args: call.function.arguments,
            err: err instanceof Error ? err.message : String(err),
          },
          'failed to parse tool args, passing empty object',
        );
      }
      const result = await executeTool(call.function.name, parsedArgs);
      const msg: ChatMsg = {
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      };
      return msg;
    }),
  );
  return results;
}

export async function runAgent(input: RunAgentInput): Promise<AgentReply> {
  const config = input.config ?? (await loadAgentConfig(input.agentType));
  if (!config.enabled) {
    throw new Error(`agent_type=${input.agentType} is disabled in agent_configs`);
  }
  const openaiKey = resolveOpenAIKey(config);
  const history = await loadHistory(input.sessionId, config.history_limit);
  const systemMessage = await buildSystemMessage(config);

  const messages: ChatMsg[] = [
    { role: 'system', content: systemMessage },
    ...history.map(
      (h): ChatMsg => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content,
      }),
    ),
    { role: 'user', content: input.userText },
  ];

  const client = getOpenAIClient(openaiKey);
  const toolSpecs = getOpenAIToolSpecs();
  const hasTools = toolSpecs.length > 0;

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let toolRounds = 0;
  let finalResponse: OpenAI.Chat.Completions.ChatCompletion | null = null;

  // Loop de tool calling. Em cada round o LLM pode:
  //   (a) pedir uma ou mais tools  → executamos e re-chamamos
  //   (b) responder direto em JSON  → fim do loop
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.chat.completions.create({
      model: config.openai_model,
      messages,
      tools: hasTools ? toolSpecs : undefined,
      response_format: {
        type: 'json_schema',
        json_schema: RESPONSE_SCHEMA,
      },
    });

    totalTokensIn += response.usage?.prompt_tokens ?? 0;
    totalTokensOut += response.usage?.completion_tokens ?? 0;

    const choiceMessage = response.choices[0]?.message;
    const toolCalls = choiceMessage?.tool_calls ?? [];

    if (toolCalls.length > 0) {
      toolRounds += 1;
      // Preserva o turno do assistant com as tool_calls (necessário pelo OpenAI)
      messages.push({
        role: 'assistant',
        content: choiceMessage?.content ?? '',
        tool_calls: toolCalls,
      });
      const toolResultMsgs = await runToolCalls(toolCalls);
      messages.push(...toolResultMsgs);
      continue;
    }

    finalResponse = response;
    break;
  }

  // Se atingiu MAX_TOOL_ROUNDS sem resposta final, força uma última call
  // sem `tools` pra LLM ser obrigado a responder em JSON estruturado.
  if (!finalResponse) {
    logger.warn(
      { max_rounds: MAX_TOOL_ROUNDS, session_id: input.sessionId },
      'reached max tool rounds, forcing final answer without tools',
    );
    const forced = await client.chat.completions.create({
      model: config.openai_model,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: RESPONSE_SCHEMA,
      },
    });
    totalTokensIn += forced.usage?.prompt_tokens ?? 0;
    totalTokensOut += forced.usage?.completion_tokens ?? 0;
    finalResponse = forced;
  }

  const choice = finalResponse.choices[0];
  const content = choice?.message?.content ?? '';
  let parsed: { mensagens?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    logger.error({ err, content }, 'agent output JSON.parse failed');
    throw new Error('agent returned invalid JSON');
  }

  const maxOut = config.max_output_messages;
  const mensagens = Array.isArray(parsed.mensagens)
    ? parsed.mensagens
        .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
        .map((m) => m.trim())
        .slice(0, maxOut)
    : [];

  if (mensagens.length === 0) {
    throw new Error('agent returned zero valid messages');
  }

  return {
    mensagens,
    model: finalResponse.model,
    tokens_in: totalTokensIn,
    tokens_out: totalTokensOut,
    tool_rounds: toolRounds,
  };
}
