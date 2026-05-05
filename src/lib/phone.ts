export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Canonicaliza número BR aplicando a regra do 9º dígito:
 * - DDD <= 28: celular DEVE ter 9 após o DDD (formato novo SP/interior/Sul etc)
 * - DDD > 28: celular NÃO tem o 9 após o DDD (norte/nordeste/centro-oeste)
 */
export function canonicalizeBrPhone(digits: string): string {
  if (!digits.startsWith('55')) return digits;

  const afterCountry = digits.slice(2);
  if (afterCountry.length < 10 || afterCountry.length > 11) return digits;

  const dddStr = afterCountry.slice(0, 2);
  const ddd = parseInt(dddStr, 10);
  if (Number.isNaN(ddd)) return digits;

  const rest = afterCountry.slice(2);

  if (ddd <= 28) {
    if (rest.length === 8) return `55${dddStr}9${rest}`;
    return digits;
  }

  if (rest.length === 9 && rest.startsWith('9')) {
    return `55${dddStr}${rest.slice(1)}`;
  }
  return digits;
}

export function phoneToSessionId(input: string): string {
  const digits = canonicalizeBrPhone(normalizePhone(input));
  return `${digits}@s.whatsapp.net`;
}

/**
 * WhatsApp JIDs que aceitamos como remetente:
 *  - <numero>@s.whatsapp.net  → formato legado (contas antigas, pessoais)
 *  - <numero>@lid             → Linked Identity (contas Business novas, 2024+)
 *
 * Grupos (@g.us), broadcasts (@broadcast) e outros são ignorados.
 */
export function isAcceptedJid(jid: string): boolean {
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
}

/**
 * Converte um JID recebido em session_id pra persistência no DB.
 *  - @lid: preserva o JID completo (única fonte da verdade pra essa conta)
 *  - @s.whatsapp.net: canonicaliza dígitos BR e re-monta o JID
 *
 * Idempotente: rodar 2x no mesmo input dá o mesmo resultado.
 */
export function jidToSessionId(jid: string): string {
  if (jid.endsWith('@lid')) return jid;
  if (jid.endsWith('@s.whatsapp.net')) {
    const digits = canonicalizeBrPhone(normalizePhone(jid));
    return `${digits}@s.whatsapp.net`;
  }
  return jid;
}

/**
 * Extrai um identificador legível do remetente, pra logs e leadPhone.
 * Pra @s.whatsapp.net: dígitos com '+' na frente.
 * Pra @lid: o JID inteiro (não tem como mapear pra E.164).
 */
export function jidToLeadIdentifier(jid: string): string {
  if (jid.endsWith('@s.whatsapp.net')) {
    return `+${jid.replace('@s.whatsapp.net', '')}`;
  }
  return jid;
}
