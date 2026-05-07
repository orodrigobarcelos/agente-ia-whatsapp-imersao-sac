/**
 * Contact identity tracking — mapeia phone_number ↔ session_id.
 *
 * Por quê: WhatsApp Business Multi-Device entrega mensagens com
 * `remoteJid: <hash>@lid` que NÃO é derivável do número telefônico.
 * Pra que humano consiga "pausar IA pro número 5521999..." sem precisar
 * adivinhar hashes, gravamos o pair toda vez que o payload do Baileys
 * expõe ambos campos.
 *
 * Tipicamente o Baileys traz:
 *   - `key.remoteJid    = <hash>@lid`              (identidade canônica)
 *   - `key.remoteJidAlt = <numero>@s.whatsapp.net` (alternativa com phone)
 * E vice-versa em conversas legacy.
 */
import { logger } from '../lib/logger.js';
import { execute, query } from '../lib/pg.js';
import { canonicalizeBrPhone, normalizePhone } from '../lib/phone.js';

/**
 * Extrai o número de telefone (só dígitos, canonicalizado pra BR) de
 * qualquer JID que termine em @s.whatsapp.net. Retorna null pra @lid
 * (hash não-derivável) e outros formatos.
 */
function jidToPhoneDigits(jid: string | undefined | null): string | null {
  if (!jid) return null;
  if (!jid.endsWith('@s.whatsapp.net')) return null;
  const digits = canonicalizeBrPhone(normalizePhone(jid));
  return digits || null;
}

/**
 * Dado os campos do `key` do Baileys + opcional pushName, faz UPSERT em
 * contact_identity pra todos os pairs (phone, session_id) que conseguir
 * extrair. Tolerante a falhas — não bloqueia o fluxo de mensagem.
 *
 * Casos cobertos:
 *  - remoteJid=@lid + remoteJidAlt=@s.whatsapp.net → 1 mapping
 *  - remoteJid=@s.whatsapp.net + remoteJidAlt=@lid → 1 mapping
 *  - remoteJid=@s.whatsapp.net (sem alt) → 1 self-mapping (phone -> phone@s.whatsapp.net)
 *  - remoteJid=@lid (sem alt com phone) → nada gravado (não temos phone)
 */
export async function upsertIdentityFromKey(input: {
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
  canonicalSessionId: string;
  pushName?: string | null;
}): Promise<void> {
  const phone =
    jidToPhoneDigits(input.remoteJid) ?? jidToPhoneDigits(input.remoteJidAlt);
  if (!phone) return;

  try {
    await execute(
      `INSERT INTO contact_identity (phone_number, session_id, push_name, last_seen_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (phone_number, session_id)
       DO UPDATE SET
         push_name = COALESCE(EXCLUDED.push_name, contact_identity.push_name),
         last_seen_at = now()`,
      [phone, input.canonicalSessionId, input.pushName ?? null],
    );
  } catch (err) {
    logger.warn(
      {
        err: err instanceof Error ? err.message : String(err),
        phone,
        session_id: input.canonicalSessionId,
      },
      'contact_identity upsert failed (non-blocking)',
    );
  }
}

/**
 * Busca todos os session_ids conhecidos pra um número de telefone.
 * Útil pra "pausar IA pro número X" descobrir os hashes @lid.
 *
 * Retorna [] se número não existe no histórico (nesse caso, caller
 * pode fazer fallback pros 2 formatos clássicos).
 */
export async function findSessionIdsByPhone(
  phoneInput: string,
): Promise<string[]> {
  const clean = canonicalizeBrPhone(normalizePhone(phoneInput));
  if (!clean) return [];

  const rows = await query<{ session_id: string }>(
    `SELECT DISTINCT session_id
       FROM contact_identity
      WHERE phone_number = $1
      ORDER BY session_id`,
    [clean],
  );
  return rows.map((r) => r.session_id);
}
