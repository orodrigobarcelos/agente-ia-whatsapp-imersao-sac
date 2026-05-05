/**
 * Skills (habilidades modulares) — markdown chunks que se acoplam ao system prompt.
 *
 * O aluno cria via Claude Code + MCP Postgres:
 *   INSERT INTO agent_skills (agent_type, name, description, content)
 *   VALUES ('default', 'agendamento', 'Use quando ...', 'Conteúdo...');
 *
 * Aqui carregamos com cache curto (30s) e construímos um bloco
 * <skills>...</skills> pra colar no system prompt antes do turno do agente.
 */
import { logger } from '../lib/logger.js';
import { query } from '../lib/pg.js';

export interface Skill {
  id: string;
  agent_type: string;
  name: string;
  description: string;
  content: string;
  active: boolean;
  updated_at: string;
}

interface CacheEntry {
  skills: Skill[];
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

// Limite total de caracteres das skills concatenadas (proteção contra inflar
// system prompt e estourar contexto). ~24k chars ≈ 6k tokens.
const MAX_SKILLS_CHARS = 24_000;

export async function loadActiveSkills(agentType: string): Promise<Skill[]> {
  const now = Date.now();
  const cached = cache.get(agentType);
  if (cached && cached.expiresAt > now) return cached.skills;

  const rows = await query<Skill>(
    `SELECT id, agent_type, name, description, content, active, updated_at
     FROM agent_skills
     WHERE agent_type = $1 AND active = true
     ORDER BY updated_at DESC`,
    [agentType],
  );

  cache.set(agentType, { skills: rows, expiresAt: now + CACHE_TTL_MS });
  return rows;
}

export function invalidateSkillsCache(agentType?: string): void {
  if (agentType) cache.delete(agentType);
  else cache.clear();
}

export function buildSkillsBlock(skills: Skill[]): string {
  if (skills.length === 0) return '';
  const parts: string[] = ['<skills>'];
  let totalChars = 0;
  let included = 0;
  let skipped = 0;
  for (const skill of skills) {
    const block =
      `\n## ${skill.name}\n` +
      `_${skill.description}_\n\n` +
      `${skill.content.trim()}\n`;
    if (totalChars + block.length > MAX_SKILLS_CHARS) {
      skipped += 1;
      continue;
    }
    parts.push(block);
    totalChars += block.length;
    included += 1;
  }
  parts.push('\n</skills>');
  if (skipped > 0) {
    logger.warn(
      { included, skipped, max_chars: MAX_SKILLS_CHARS },
      'skills truncated to fit system prompt budget',
    );
  }
  return parts.join('');
}

export async function buildSkillsBlockFor(agentType: string): Promise<string> {
  const skills = await loadActiveSkills(agentType);
  return buildSkillsBlock(skills);
}
