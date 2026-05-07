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
--  6) contact_identity — mapeia phone_number ↔ session_id
-- ============================================================================
-- WhatsApp Business Multi-Device entrega mensagens com identidade @lid
-- (hash anônimo NÃO derivável do número telefônico). Pra que o operador
-- humano consiga "pausar IA pro número 5521999..." sem precisar adivinhar
-- hashes, gravamos o pair (phone_number, session_id) toda vez que recebemos
-- mensagem que exponha ambos no payload do Baileys (remoteJid + remoteJidAlt).
--
-- Múltiplos session_ids podem corresponder ao mesmo phone_number ao longo
-- do tempo (ex: cliente trocou de aparelho/Business), por isso PK composta.
create table if not exists public.contact_identity (
  phone_number   text not null,
  session_id     text not null,
  push_name      text,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  primary key (phone_number, session_id)
);

create index if not exists contact_identity_session_idx
  on public.contact_identity (session_id);

create index if not exists contact_identity_phone_idx
  on public.contact_identity (phone_number);

-- ============================================================================
--  7) is_ai_paused() — checa se a IA está pausada pra uma sessão
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

-- ============================================================================
--  8) pause_ai_by_phone() — pausa todas as sessões conhecidas de um número
-- ============================================================================
-- Helper pra resolver o problema "cliente mandou mas pausamos só
-- @s.whatsapp.net e mensagem chegou em @lid". Usa contact_identity pra
-- descobrir TODOS os session_ids associados ao número e pausa todos de uma
-- vez. Se nenhum mapping existir ainda, faz fallback pros 2 formatos
-- clássicos. Retorna o array de session_ids efetivamente pausados.
create or replace function public.pause_ai_by_phone(
  p_phone_number text,
  p_paused_by    text default 'manual'
)
returns text[]
language plpgsql
as $$
declare
  v_clean    text;
  v_targets  text[];
begin
  v_clean := regexp_replace(p_phone_number, '\D', '', 'g');

  -- Tenta achar session_ids conhecidos via contact_identity
  select array_agg(distinct session_id)
    into v_targets
    from public.contact_identity
   where phone_number = v_clean;

  -- Fallback: se não há mapping ainda, gera os 2 formatos clássicos
  if v_targets is null or cardinality(v_targets) = 0 then
    v_targets := array[
      v_clean || '@s.whatsapp.net',
      v_clean || '@lid'
    ];
  end if;

  -- UPSERT em chat_control pra todos os targets
  insert into public.chat_control (session_id, instance, agent_type, ai_paused, paused_at, paused_by)
  select target, 'agente', 'default', true, now(), p_paused_by
    from unnest(v_targets) as target
  on conflict (session_id) do update
    set ai_paused = true,
        paused_at = now(),
        paused_by = excluded.paused_by;

  return v_targets;
end;
$$;

-- ============================================================================
--  9) resume_ai_by_phone() — reativa todas as sessões conhecidas de um número
-- ============================================================================
create or replace function public.resume_ai_by_phone(p_phone_number text)
returns text[]
language plpgsql
as $$
declare
  v_clean    text;
  v_targets  text[];
begin
  v_clean := regexp_replace(p_phone_number, '\D', '', 'g');

  select array_agg(distinct session_id)
    into v_targets
    from public.contact_identity
   where phone_number = v_clean;

  if v_targets is null or cardinality(v_targets) = 0 then
    v_targets := array[
      v_clean || '@s.whatsapp.net',
      v_clean || '@lid'
    ];
  end if;

  update public.chat_control
     set ai_paused = false,
         paused_at = null,
         paused_by = null
   where session_id = any(v_targets);

  return v_targets;
end;
$$;
