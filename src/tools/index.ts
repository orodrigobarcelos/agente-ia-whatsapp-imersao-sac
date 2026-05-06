/**
 * Auto-load de todas as tools — built-in + custom.
 *
 * Cada import abaixo dispara um `registerTool({...})` por side-effect.
 * Quando o aluno cria uma nova tool em `src/tools/custom/<nome>.ts`, o
 * Claude Code adiciona uma linha aqui automaticamente.
 *
 * Re-exporta a API pública pra resto do app consumir.
 */

// ─── Built-in (vêm de fábrica) ────────────────────────────────────
import './builtin/current-time.js';

// ─── Custom (criadas pelo aluno) ──────────────────────────────────
// Claude Code adiciona linhas `import './custom/<nome>.js';` aqui
// quando o aluno pede uma tool nova. NÃO REMOVA esse comentário.

// ─── API pública ──────────────────────────────────────────────────
export { registerTool } from './registry.js';
export { getAllTools, getTool, getOpenAIToolSpecs } from './registry.js';
export { executeTool } from './runner.js';
export type { ToolDefinition, ToolHandler, ToolResult } from './types.js';
