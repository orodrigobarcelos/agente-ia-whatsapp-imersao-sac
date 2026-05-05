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
    const number = normalizePhone(to);
    if (!number) throw new Error(`invalid phone: ${to}`);

    const result = await this.request<unknown>(
      'POST',
      `/message/sendText/${encodeURIComponent(instance)}`,
      { number, text },
    );

    if (!result.ok) {
      logger.warn(
        { status: result.status, body: result.raw, instance, to: number },
        'evolution sendText failed',
      );
      throw new EvolutionError(
        `Evolution sendText failed: ${result.status}`,
        result.status,
        result.raw,
      );
    }

    return { messageId: extractMessageId(result.data), raw: result.data ?? {} };
  }

  async sendPresence(
    instance: string,
    to: string,
    presence: EvolutionPresence,
    delayMs = 0,
  ): Promise<void> {
    const number = normalizePhone(to);
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

  async connectInstance(instanceName: string): Promise<InstanceConnectResult> {
    const result = await this.request<InstanceConnectResult>(
      'GET',
      `/instance/connect/${encodeURIComponent(instanceName)}`,
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
