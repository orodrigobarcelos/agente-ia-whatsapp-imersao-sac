-- ============================================================================
--  Template Agente IA WhatsApp Simplificado — Schema Postgres
--
--  Este schema é APLICADO AUTOMATICAMENTE no boot do agente (db/migrate.ts).
--  Idempotente: pode rodar várias vezes sem quebrar.
--
--  Convenção: tabelas em snake_case (não conflitam com tabelas PascalCase
--  que a Evolution cria no mesmo Postgres se for compartilhado).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
--  Trigger genérico de updated_at
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
--  1) agent_configs — config principal do agente (prompt, modelo, timings)
-- ============================================================================
create table if not exists public.agent_configs (
  agent_type              text primary key,
  enabled                 boolean not null default true,
  openai_api_key          text,
  openai_model            text not null default 'gpt-4.1-mini',
  system_prompt           text not null,
  debounce_ms             integer not null default 15000,
  typing_ms               integer not null default 1000,
  inter_message_delay_ms  integer not null default 1000,
  history_limit           integer not null default 30,
  max_output_messages     integer not null default 5,
  updated_at              timestamptz not null default now()
);

drop trigger if exists agent_configs_touch on public.agent_configs;
create trigger agent_configs_touch
  before update on public.agent_configs
  for each row execute function public.touch_updated_at();

-- ============================================================================
--  2) agent_skills — skills (habilidades modulares) que se injetam no prompt
--
--  O aluno cria skills via Claude Code + MCP Postgres:
--    INSERT INTO agent_skills (name, description, content)
--    VALUES ('agendamento', 'Use quando ...', 'Conteúdo da skill...');
--
--  O agente carrega todas as skills com active=true em cada turno (cache 30s)
--  e injeta no system prompt num bloco delimitado <skills>...</skills>.
-- ============================================================================
create table if not exists public.agent_skills (
  id           uuid primary key default gen_random_uuid(),
  agent_type   text not null default 'default',
  name         text not null,
  description  text not null,
  content      text not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists agent_skills_agent_name_idx
  on public.agent_skills (agent_type, name);

create index if not exists agent_skills_active_idx
  on public.agent_skills (agent_type, active)
  where active = true;

drop trigger if exists agent_skills_touch on public.agent_skills;
create trigger agent_skills_touch
  before update on public.agent_skills
  for each row execute function public.touch_updated_at();

-- ============================================================================
--  3) chat_messages — histórico completo da conversa
-- ============================================================================
create table if not exists public.chat_messages (
  id                    uuid primary key default gen_random_uuid(),
  session_id            text not null,
  instance              text not null,
  role                  text not null check (role in ('user','assistant','system','tool')),
  content               text not null,
  media_type            text,
  transcription         text,
  evolution_message_id  text,
  status                text default 'received',
  model                 text,
  tokens_in             integer,
  tokens_out            integer,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists chat_messages_session_created_idx
  on public.chat_messages (session_id, created_at desc);

create index if not exists chat_messages_pending_assistant_idx
  on public.chat_messages (status, created_at)
  where role = 'assistant' and status = 'pending';

create unique index if not exists chat_messages_evolution_unique_idx
  on public.chat_messages (evolution_message_id)
  where evolution_message_id is not null;

-- ============================================================================
--  4) chat_control — pause/resume da IA por sessão (atendente humano assume)
-- ============================================================================
create table if not exists public.chat_control (
  session_id   text primary key,
  instance     text not null,
  agent_type   text not null default 'default',
  ai_paused    boolean not null default false,
  paused_at    timestamptz,
  paused_by    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists chat_control_touch on public.chat_control;
create trigger chat_control_touch
  before update on public.chat_control
  for each row execute function public.touch_updated_at();

-- ============================================================================
--  5) message_buffer — buffer com debounce pra agrupar mensagens curtas
-- ============================================================================
create table if not exists public.message_buffer (
  id                    uuid primary key default gen_random_uuid(),
  session_id            text not null,
  instance              text not null,
  lead_phone            text not null,
  mensagem              text not null,
  evolution_message_id  text,
  media_type            text,
  media_url             text,
  transcription         text,
  processed_at          timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists message_buffer_session_pending_idx
  on public.message_buffer (session_id, created_at)
  where processed_at is null;

create unique index if not exists message_buffer_evolution_unique_idx
  on public.message_buffer (evolution_message_id)
  where evolution_message_id is not null;

-- ============================================================================
--  6) is_ai_paused() — checa se a IA está pausada pra uma sessão
-- ============================================================================
create or replace function public.is_ai_paused(p_session_id text)
returns boolean
language sql
stable
as $$
  select coalesce(
    (select ai_paused from public.chat_control where session_id = p_session_id),
    false
  );
$$;
