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

// Mutex pra evitar bootstraps concorrentes (boot inicial + janitor tick
// + chamada manual). Sem isso, dois `createInstance` simultâneos podem
// gerar dois `setWebhook` em ordem indeterminada e deixar o webhook
// registrado errado.
let bootstrapInflight: Promise<EvolutionBootstrapResult | null> | null = null;

export async function bootstrapEvolution(): Promise<EvolutionBootstrapResult | null> {
  if (bootstrapInflight) {
    logger.debug('bootstrapEvolution already running, awaiting in-flight call');
    return bootstrapInflight;
  }
  bootstrapInflight = bootstrapEvolutionInner().finally(() => {
    bootstrapInflight = null;
  });
  return bootstrapInflight;
}

async function bootstrapEvolutionInner(): Promise<EvolutionBootstrapResult | null> {
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

// ────────────────────────────────────────────────────────────────────
// Janitor: detecta instance ausente e dispara recriação automática.
//
// Cenário coberto: operador (ou Claude Code via API) faz
// `DELETE /instance/delete/<inst>` pra resetar state Baileys podre.
// Sem o janitor, o Agente fica "órfão" — não tem instance pra usar e
// só recria quando o service Agente é restartado manualmente.
//
// O janitor checa a cada N segundos se a instance existe. Se não,
// dispara `bootstrapEvolution()` pra recriar do zero. Bootstrap também
// re-registra o webhook, então a recuperação é completa.
// ────────────────────────────────────────────────────────────────────

const JANITOR_INTERVAL_MS = 60_000;

let janitorHandle: ReturnType<typeof setInterval> | null = null;
let janitorTickInProgress = false;

async function janitorTick(): Promise<void> {
  if (!env.EVOLUTION_URL || !env.EVOLUTION_API_KEY) return;

  const instanceName = env.EVOLUTION_INSTANCE;
  const evolution = getEvolutionClient();

  let instances: EvolutionInstance[];
  try {
    instances = await evolution.fetchInstances();
  } catch (err) {
    // Falha de comunicação não dispara recreate — Evolution pode estar
    // restartando ou rede instável. Só loga e tenta de novo na próxima.
    logger.debug(
      { err: err instanceof Error ? err.message : String(err) },
      'evolution janitor: fetchInstances failed, skipping tick',
    );
    return;
  }

  const exists = instances.some((i) => pickInstanceName(i) === instanceName);
  if (exists) return;

  logger.warn(
    { instanceName },
    'evolution janitor: instance missing, triggering re-bootstrap',
  );

  try {
    const result = await bootstrapEvolution();
    if (result?.created) {
      logger.info(
        { instanceName, webhookUrl: result.webhookUrl },
        'evolution janitor: instance re-created successfully',
      );
    } else {
      logger.warn(
        { instanceName, result },
        'evolution janitor: re-bootstrap returned without creating instance',
      );
    }
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'evolution janitor: re-bootstrap threw',
    );
  }
}

export function startEvolutionJanitor(): void {
  if (janitorHandle) return;
  janitorHandle = setInterval(() => {
    if (janitorTickInProgress) {
      logger.debug('evolution janitor tick skipped (previous still running)');
      return;
    }
    janitorTickInProgress = true;
    janitorTick()
      .catch((err) => {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'evolution janitor tick threw',
        );
      })
      .finally(() => {
        janitorTickInProgress = false;
      });
  }, JANITOR_INTERVAL_MS);
  logger.info(
    { interval_ms: JANITOR_INTERVAL_MS },
    'evolution janitor started',
  );
}

export async function stopEvolutionJanitor(
  drainTimeoutMs = 3_000,
): Promise<void> {
  if (!janitorHandle) return;
  clearInterval(janitorHandle);
  janitorHandle = null;

  // Se um tick estiver no meio de chamar Evolution (pode levar segundos),
  // aguarda terminar antes de devolver controle pra shutdown — senão o
  // closePool() pode disparar enquanto o tick ainda escreve em log/etc.
  const deadline = Date.now() + drainTimeoutMs;
  while (janitorTickInProgress && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (janitorTickInProgress) {
    logger.warn(
      { drainTimeoutMs },
      'evolution janitor stopped but tick still in progress (timed out)',
    );
  } else {
    logger.info('evolution janitor stopped');
  }
}

/**
 * Remove campos do payload de settings que NÃO devem ser repostados pra
 * Evolution durante o GET-then-merge.
 *
 * Motivo: postar `wavoipToken` (mesmo vazio) reinicializa o módulo VoIP
 * dentro do Evolution v2.3.7. Esse reinit dispara durante o pareamento
 * WhatsApp Web e produz `stream:error tag:conflict type:replaced`,
 * derrubando a conexão logo após "CONNECTED TO WHATSAPP". Chip pessoal
 * é afetado; chip Business às vezes escapa por permissões diferentes.
 *
 * Como o nosso agente NÃO usa VoIP, esses campos podem ser omitidos sem
 * impacto funcional. Outros campos (groupsIgnore, readMessages, etc) são
 * preservados.
 */
const VOIP_FIELDS = ['wavoipToken'] as const;

function sanitizeSettings(
  current: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!current) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(current)) {
    if ((VOIP_FIELDS as readonly string[]).includes(key)) continue;
    clean[key] = value;
  }
  return clean;
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
  // Delay inicial: Evolution v2.3.7 às vezes rejeita /settings/set logo após
  // o /instance/create porque a instância ainda está finalizando init interno.
  await new Promise((r) => setTimeout(r, 3_000));

  const evolution = getEvolutionClient();
  const maxAttempts = 3;
  let lastError: unknown = null;
  let lastErrorBody: string | null = null;

  // Defaults que queremos aplicar.
  const desiredOverrides = {
    groupsIgnore: true,
    readMessages: false,
    readStatus: false,
    rejectCall: false,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // GET-then-merge: pega settings atuais (com TODOS os campos que Evolution
      // expõe, incluindo campos novos que possam ter sido adicionados em
      // versões mais recentes), sobrescreve apenas os que queremos mudar, e
      // posta o body COMPLETO de volta. Isso evita 400 por campos faltando.
      //
      // EXCEÇÃO: campos relacionados a VoIP (wavoipToken, etc) são EXCLUÍDOS
      // do body. Postar wavoipToken (mesmo vazio) pode reinicializar o módulo
      // VoIP no Evolution v2.3.7 e causar `stream:error tag:conflict
      // type:replaced` durante o pareamento WhatsApp Web — quebrando a
      // conexão do chip pessoal logo após "CONNECTED TO WHATSAPP".
      const current = await evolution.getSettings(instanceName).catch(() => null);
      const sanitized = sanitizeSettings(current);
      const merged = {
        ...sanitized,
        ...desiredOverrides,
      };

      await evolution.setSettings({
        instanceName,
        ...merged,
      });
      logger.info(
        { instanceName, attempt, sent: Object.keys(merged) },
        'Evolution default settings applied',
      );

      // Verifica que pegou de fato (Evolution v2 às vezes responde 200 mas
      // não persiste se enviado antes da instância estar 100% pronta).
      const verify = await evolution.getSettings(instanceName).catch(() => null);
      if (verify && verify.groupsIgnore !== true) {
        logger.warn(
          { instanceName, attempt, verify },
          'settings POST returned 200 but groupsIgnore is still false; retrying',
        );
        lastError = new Error('settings did not persist');
        await new Promise((r) => setTimeout(r, 2_000));
        continue;
      }
      return;
    } catch (err) {
      lastError = err;
      // Captura o body do erro pra debug (Evolution costuma retornar mensagem
      // útil tipo "Validation failed: campo X faltando").
      lastErrorBody =
        err instanceof EvolutionError
          ? err.body
          : err instanceof Error
            ? err.message
            : String(err);
      logger.warn(
        {
          err: err instanceof Error ? err.message : String(err),
          body: lastErrorBody,
          instanceName,
          attempt,
          maxAttempts,
        },
        'apply default settings failed; will retry',
      );
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2_000));
      }
    }
  }

  logger.warn(
    {
      err: lastError instanceof Error ? lastError.message : String(lastError),
      body: lastErrorBody,
      instanceName,
    },
    'failed to apply default settings after retries (instance still functional, configure manually in Evolution Manager)',
  );
}
