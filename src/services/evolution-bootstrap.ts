/**
 * Bootstrap idempotente da instância Evolution.
 *
 * Roda no boot do agente:
 *  1. Aguarda Evolution responder (com retry).
 *  2. Verifica se a instância existe (fetchInstances).
 *  3. Se NÃO existe → cria com webhook apontando pra esse próprio agente
 *     + eventos MESSAGES_UPSERT e MESSAGES_UPDATE.
 *  4. Se EXISTE → reseta o webhook (caso a URL pública tenha mudado).
 *
 * Aluno NUNCA precisa abrir o Evolution Manager pra configurar webhook.
 */
import { env, resolvePublicUrl } from '../config/env.js';
import {
  EvolutionError,
  getEvolutionClient,
  type EvolutionInstance,
} from '../lib/evolution.js';
import { logger } from '../lib/logger.js';

const REQUIRED_EVENTS = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE'];

function pickInstanceName(item: EvolutionInstance): string | null {
  if (typeof item.instanceName === 'string') return item.instanceName;
  const inst = (item as { instance?: { instanceName?: string } }).instance;
  if (inst && typeof inst.instanceName === 'string') return inst.instanceName;
  const name = (item as { name?: string }).name;
  if (typeof name === 'string') return name;
  return null;
}

async function waitForEvolution(maxAttempts = 30, delayMs = 2_000): Promise<boolean> {
  const evolution = getEvolutionClient();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await evolution.fetchInstances();
      return true;
    } catch (err) {
      logger.debug(
        {
          attempt,
          max: maxAttempts,
          err: err instanceof Error ? err.message : String(err),
        },
        'evolution not ready yet, retrying',
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

export interface EvolutionBootstrapResult {
  instanceName: string;
  webhookUrl: string;
  created: boolean;
  webhookUpdated: boolean;
}

export async function bootstrapEvolution(): Promise<EvolutionBootstrapResult | null> {
  if (!env.EVOLUTION_URL || !env.EVOLUTION_API_KEY) {
    logger.warn(
      'Evolution não configurado (EVOLUTION_URL/EVOLUTION_API_KEY ausentes), pulando bootstrap',
    );
    return null;
  }

  const publicUrl = resolvePublicUrl();
  if (!publicUrl) {
    logger.warn(
      'PUBLIC_URL ou RAILWAY_PUBLIC_DOMAIN ausente, pulando bootstrap (webhook não pode ser registrado)',
    );
    return null;
  }

  const instanceName = env.EVOLUTION_INSTANCE;
  const webhookUrl = `${publicUrl}/webhooks/evolution`;

  logger.info({ instanceName, webhookUrl }, 'starting Evolution bootstrap');

  const ready = await waitForEvolution();
  if (!ready) {
    logger.error(
      { url: env.EVOLUTION_URL },
      'Evolution did not become ready in time, skipping bootstrap',
    );
    return null;
  }

  const evolution = getEvolutionClient();

  // Evolution v2.3.7 retorna 404 quando passamos ?instanceName=X e a instância
  // não existe (em versões antigas retornava []). Pra não tropeçar nesse 404,
  // listamos TODAS as instâncias sem filtro e procuramos a nossa localmente.
  let instances: EvolutionInstance[];
  try {
    instances = await evolution.fetchInstances();
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'fetchInstances failed during bootstrap',
    );
    return null;
  }

  const existing = instances.find((i) => pickInstanceName(i) === instanceName);

  if (!existing) {
    try {
      await evolution.createInstance({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: { url: webhookUrl, events: REQUIRED_EVENTS },
      });
      logger.info({ instanceName, webhookUrl }, 'Evolution instance created');
      await applyDefaultSettings(instanceName);
      return { instanceName, webhookUrl, created: true, webhookUpdated: true };
    } catch (err) {
      const status = err instanceof EvolutionError ? err.status : null;
      // 409/403 podem indicar que já existe — tenta reaproveitar.
      if (status === 409 || status === 403) {
        logger.warn(
          { status, err: err instanceof Error ? err.message : String(err) },
          'createInstance reported conflict, falling through to setWebhook',
        );
      } else {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'createInstance failed',
        );
        return null;
      }
    }
  } else {
    logger.info({ instanceName }, 'Evolution instance already exists, ensuring webhook');
  }

  try {
    await evolution.setWebhook({
      instanceName,
      url: webhookUrl,
      events: REQUIRED_EVENTS,
      enabled: true,
    });
    logger.info({ instanceName, webhookUrl }, 'Evolution webhook set');
    await applyDefaultSettings(instanceName);
    return {
      instanceName,
      webhookUrl,
      created: !existing,
      webhookUpdated: true,
    };
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'setWebhook failed',
    );
    return {
      instanceName,
      webhookUrl,
      created: !existing,
      webhookUpdated: false,
    };
  }
}

/**
 * Aplica defaults sensatos para uma instância recém-criada (ou já existente):
 *  - groupsIgnore=true  → ignora mensagens de grupos (agente é 1-1)
 *  - readMessages=false → não marca mensagens como lidas (privacidade)
 *  - readStatus=false   → não marca status como lidos
 *  - rejectCall=false   → não rejeita ligações (deixa o WhatsApp decidir)
 *
 * Idempotente — pode rodar toda vez que o agente sobe sem efeito colateral.
 */
async function applyDefaultSettings(instanceName: string): Promise<void> {
  try {
    const evolution = getEvolutionClient();
    await evolution.setSettings({
      instanceName,
      groupsIgnore: true,
      readMessages: false,
      readStatus: false,
      rejectCall: false,
    });
    logger.info({ instanceName }, 'Evolution default settings applied');
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), instanceName },
      'failed to apply default settings (instance still functional)',
    );
  }
}
