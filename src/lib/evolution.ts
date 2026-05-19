import { env } from '../config/env.js';
import { logger } from './logger.js';
import { normalizePhone } from './phone.js';

export class EvolutionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'EvolutionError';
  }
}

/**
 * Substrings que aparecem no body do erro 400 do Evolution quando o
 * Baileys ABORTA o envio ANTES de despachar pro WhatsApp — ou seja,
 * é seguro retentar sem risco de duplicar mensagem do lado do cliente.
 *
 * Lista propositadamente conservadora. NÃO inclui `socket hang up`,
 * `econnreset`, `timeout` puro: esses indicam que o request HTTP
 * Agente↔Evolution morreu DEPOIS que Baileys já tinha despachado a
 * mensagem pro WhatsApp — retry causaria duplicata. Evolution v2.x
 * não tem `clientMessageId` pra idempotência, então sem proteção
 * server-side.
 */
const TRANSIENT_ERROR_INDICATORS = [
  'connection closed',
  'connection lost',
  'operation aborted',
  'this operation was aborted',
];

export function isTransientEvolutionError(
  status: number,
  body: string,
): boolean {
  if (status >= 500) return true;
  if (status === 408 || status === 409 || status === 503) return true;
  if (status === 400) {
    const lower = body.toLowerCase();
    return TRANSIENT_ERROR_INDICATORS.some((ind) => lower.includes(ind));
  }
  return false;
}

export interface SendTextResult {
  messageId: string;
  raw: unknown;
}

export type EvolutionPresence = 'composing' | 'paused' | 'available' | 'unavailable';

export interface EvolutionClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export interface EvolutionInstance {
  instanceName?: string;
  state?: string;
  status?: string;
  [key: string]: unknown;
}

export interface InstanceConnectResult {
  base64?: string;
  code?: string;
  pairingCode?: string;
  count?: number;
  [key: string]: unknown;
}

export class EvolutionClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor({ baseUrl, apiKey, timeoutMs = 15_000 }: EvolutionClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  private async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; data: T | null; raw: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const raw = await response.text();
    let data: T | null = null;
    if (raw) {
      try {
        data = JSON.parse(raw) as T;
      } catch {
        data = null;
      }
    }
    return { ok: response.ok, status: response.status, data, raw };
  }

  async sendText(
    instance: string,
    to: string,
    text: string,
  ): Promise<SendTextResult> {
    // Se 'to' já é um JID completo (`@s.whatsapp.net` ou `@lid`),
    // passamos como está — Evolution roteia pra identidade certa.
    // Senão, extraímos só os dígitos pra retrocompatibilidade.
    const number = to.includes('@') ? to : normalizePhone(to);
    if (!number) throw new Error(`invalid phone: ${to}`);

    // Retry com backoff em erros transitórios do Baileys/Evolution:
    //  - 400 com "Connection Closed" / "operation aborted" / "timed out"
    //    → state interno do Baileys ficou stale após sync inicial pesado
    //  - 5xx → server error (raro mas trata igual)
    // 4 tentativas total: imediata, +5s, +15s, +30s = ~50s no pior caso.
    // Webhook do Evolution já foi confirmado (200) lá no início, então
    // esse atraso só impacta UX (cliente WhatsApp vê "digitando..." mais
    // tempo). Erros permanentes (404, 422) NÃO retentam.
    const delaysMs = [0, 5_000, 15_000, 30_000];
    let lastStatus = 0;
    let lastBody = '';

    for (let attempt = 0; attempt < delaysMs.length; attempt++) {
      if (delaysMs[attempt]! > 0) {
        logger.info(
          {
            instance,
            to: number,
            attempt: attempt + 1,
            delay_ms: delaysMs[attempt],
            last_status: lastStatus,
          },
          'evolution sendText retrying after transient error',
        );
        await new Promise((r) => setTimeout(r, delaysMs[attempt]));
      }

      const result = await this.request<unknown>(
        'POST',
        `/message/sendText/${encodeURIComponent(instance)}`,
        { number, text },
      );
      lastStatus = result.status;
      lastBody = result.raw;

      if (result.ok) {
        return {
          messageId: extractMessageId(result.data),
          raw: result.data ?? {},
        };
      }

      if (!isTransientEvolutionError(result.status, result.raw)) {
        break; // erro permanente — não retenta
      }
    }

    logger.warn(
      { status: lastStatus, body: lastBody, instance, to: number },
      'evolution sendText failed after retries',
    );
    throw new EvolutionError(
      `Evolution sendText failed: ${lastStatus}`,
      lastStatus,
      lastBody,
    );
  }

  async sendPresence(
    instance: string,
    to: string,
    presence: EvolutionPresence,
    delayMs = 0,
  ): Promise<void> {
    const number = to.includes('@') ? to : normalizePhone(to);
    if (!number) throw new Error(`invalid phone: ${to}`);

    const result = await this.request(
      'POST',
      `/chat/sendPresence/${encodeURIComponent(instance)}`,
      { number, presence, delay: delayMs },
    );

    if (!result.ok) {
      logger.warn(
        { status: result.status, body: result.raw, instance, to: number, presence },
        'evolution sendPresence failed',
      );
    }
  }

  async fetchInstances(instanceName?: string): Promise<EvolutionInstance[]> {
    const qs = instanceName ? `?instanceName=${encodeURIComponent(instanceName)}` : '';
    const result = await this.request<EvolutionInstance[] | EvolutionInstance>(
      'GET',
      `/instance/fetchInstances${qs}`,
    );
    // Evolution v2.3.7 returns 404 when filtering by instanceName and the
    // instance doesn't exist. Treat as empty list so callers can decide.
    if (result.status === 404 && instanceName) return [];
    if (!result.ok) {
      throw new EvolutionError(
        `Evolution fetchInstances failed: ${result.status}`,
        result.status,
        result.raw,
      );
    }
    if (Array.isArray(result.data)) return result.data;
    if (result.data && typeof result.data === 'object') return [result.data];
    return [];
  }

  async createInstance(params: {
    instanceName: string;
    integration?: string;
    qrcode?: boolean;
    webhook?: {
      url: string;
      events: string[];
      byEvents?: boolean;
      base64?: boolean;
    };
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      instanceName: params.instanceName,
      integration: params.integration ?? 'WHATSAPP-BAILEYS',
      qrcode: params.qrcode ?? true,
    };
    if (params.webhook) {
      body.webhook = {
        url: params.webhook.url,
        byEvents: params.webhook.byEvents ?? false,
        base64: params.webhook.base64 ?? false,
        events: params.webhook.events,
      };
    }
    const result = await this.request('POST', '/instance/create', body);
    if (!result.ok) {
      throw new EvolutionError(
        `Evolution createInstance failed: ${result.status}`,
        result.status,
        result.raw,
      );
    }
    return result.data ?? {};
  }

  async getSettings(instanceName: string): Promise<{
    rejectCall?: boolean;
    msgCall?: string;
    groupsIgnore?: boolean;
    alwaysOnline?: boolean;
    readMessages?: boolean;
    readStatus?: boolean;
    syncFullHistory?: boolean;
    [key: string]: unknown;
  } | null> {
    const result = await this.request<Record<string, unknown>>(
      'GET',
      `/settings/find/${encodeURIComponent(instanceName)}`,
    );
    if (!result.ok || !result.data) return null;
    return result.data as {
      rejectCall?: boolean;
      msgCall?: string;
      groupsIgnore?: boolean;
      alwaysOnline?: boolean;
      readMessages?: boolean;
      readStatus?: boolean;
      syncFullHistory?: boolean;
    };
  }

  async setSettings(params: {
    instanceName: string;
    rejectCall?: boolean;
    msgCall?: string;
    groupsIgnore?: boolean;
    alwaysOnline?: boolean;
    readMessages?: boolean;
    readStatus?: boolean;
    syncFullHistory?: boolean;
  }): Promise<void> {
    const body: Record<string, unknown> = {};
    if (params.rejectCall !== undefined) body.rejectCall = params.rejectCall;
    if (params.msgCall !== undefined) body.msgCall = params.msgCall;
    if (params.groupsIgnore !== undefined) body.groupsIgnore = params.groupsIgnore;
    if (params.alwaysOnline !== undefined) body.alwaysOnline = params.alwaysOnline;
    if (params.readMessages !== undefined) body.readMessages = params.readMessages;
    if (params.readStatus !== undefined) body.readStatus = params.readStatus;
    if (params.syncFullHistory !== undefined) body.syncFullHistory = params.syncFullHistory;

    const result = await this.request(
      'POST',
      `/settings/set/${encodeURIComponent(params.instanceName)}`,
      body,
    );
    if (!result.ok) {
      logger.warn(
        { status: result.status, body: result.raw, instance: params.instanceName },
        'evolution setSettings failed',
      );
      throw new EvolutionError(
        `Evolution setSettings failed: ${result.status}`,
        result.status,
        result.raw,
      );
    }
  }

  async setWebhook(params: {
    instanceName: string;
    url: string;
    events: string[];
    enabled?: boolean;
    byEvents?: boolean;
    base64?: boolean;
  }): Promise<void> {
    const body = {
      webhook: {
        enabled: params.enabled ?? true,
        url: params.url,
        byEvents: params.byEvents ?? false,
        base64: params.base64 ?? false,
        events: params.events,
      },
    };
    const result = await this.request(
      'POST',
      `/webhook/set/${encodeURIComponent(params.instanceName)}`,
      body,
    );
    if (!result.ok) {
      logger.warn(
        { status: result.status, body: result.raw, instance: params.instanceName },
        'evolution setWebhook failed',
      );
      throw new EvolutionError(
        `Evolution setWebhook failed: ${result.status}`,
        result.status,
        result.raw,
      );
    }
  }

  async connectInstance(
    instanceName: string,
    number?: string,
  ): Promise<InstanceConnectResult> {
    // Quando `number` é passado, Evolution gera um CÓDIGO DE PAREAMENTO
    // (pairingCode) em vez de só o QR — o aluno digita esse código em
    // "Conectar com número de telefone" no WhatsApp. Caminho alternativo
    // útil quando o WhatsApp recusa o scan do QR.
    const qs = number ? `?number=${encodeURIComponent(number)}` : '';
    const result = await this.request<InstanceConnectResult>(
      'GET',
      `/instance/connect/${encodeURIComponent(instanceName)}${qs}`,
    );
    if (!result.ok) {
      throw new EvolutionError(
        `Evolution connect failed: ${result.status}`,
        result.status,
        result.raw,
      );
    }
    return result.data ?? {};
  }

  // Desconecta/limpa a sessão Baileys da instância. Necessário antes de
  // pedir um código de pareamento: se a instância já está "presa" no modo
  // QR, o connect com ?number= devolve QR de novo (pairingCode null). O
  // logout reseta a sessão pra o próximo connect gerar o código.
  // NÃO lança em falha — logout numa instância já desconectada pode 404.
  async logoutInstance(instanceName: string): Promise<void> {
    const result = await this.request(
      'DELETE',
      `/instance/logout/${encodeURIComponent(instanceName)}`,
    );
    if (!result.ok) {
      logger.warn(
        { status: result.status, body: result.raw, instance: instanceName },
        'evolution logoutInstance failed (ignorável se já desconectada)',
      );
    }
  }

  async connectionState(
    instanceName: string,
  ): Promise<{ state: string; raw: unknown }> {
    const result = await this.request<{
      instance?: { state?: string };
      state?: string;
    }>('GET', `/instance/connectionState/${encodeURIComponent(instanceName)}`);
    if (!result.ok) {
      return { state: 'unknown', raw: result.raw };
    }
    const state =
      result.data?.instance?.state ?? result.data?.state ?? 'unknown';
    return { state, raw: result.data ?? {} };
  }
}

function extractMessageId(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null) return '';
  const maybeKey = (raw as { key?: unknown }).key;
  if (typeof maybeKey === 'object' && maybeKey !== null) {
    const id = (maybeKey as { id?: unknown }).id;
    if (typeof id === 'string') return id;
  }
  return '';
}

let cachedClient: EvolutionClient | null = null;

export function getEvolutionClient(): EvolutionClient {
  if (cachedClient) return cachedClient;
  if (!env.EVOLUTION_URL || !env.EVOLUTION_API_KEY) {
    throw new Error(
      'Evolution client not configured: EVOLUTION_URL and EVOLUTION_API_KEY are required',
    );
  }
  cachedClient = new EvolutionClient({
    baseUrl: env.EVOLUTION_URL,
    apiKey: env.EVOLUTION_API_KEY,
  });
  return cachedClient;
}

export function resetEvolutionClient(): void {
  cachedClient = null;
}
