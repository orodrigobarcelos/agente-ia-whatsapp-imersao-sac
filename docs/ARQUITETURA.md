# Arquitetura — referência técnica

Este documento existe pra quem quiser entender o que está rodando por baixo. **O aluno leigo NÃO precisa ler isso pra usar o agente.**

---

## Visão geral

```
                    ┌─────────────────────────────────────┐
                    │        Conta Railway do aluno       │
                    │                                     │
   WhatsApp         │  ┌──────────┐    ┌──────────┐       │
   (chip do  ◄──────┼──┤ Evolution├────┤ Postgres │       │
   aluno)           │  │   API    │    │          │       │
                    │  └────┬─────┘    └────┬─────┘       │
                    │       │ webhook       │             │
                    │       ▼               │             │
                    │  ┌──────────┐         │             │
                    │  │  Agente  ├─────────┘             │
                    │  │  (Node)  │                       │
                    │  └────┬─────┘                       │
                    │       │ HTTPS                       │
                    └───────┼─────────────────────────────┘
                            │
                            ▼ (chat completions)
                    ┌──────────────┐
                    │   OpenAI     │
                    │   API        │
                    └──────────────┘

         ┌─────────────────────────┐
         │ Máquina do aluno        │
         │  ┌──────────────────┐   │
         │  │ Claude Code      │   │
         │  │ desktop          │   │
         │  └──────┬───────────┘   │
         │         │ MCP stdio     │
         │         ▼               │
         │  ┌──────────────────┐   │  TCP
         │  │ postgres-mcp     ├───┼──────► (Postgres acima, via DATABASE_PUBLIC_URL)
         │  │ server (npx)     │   │
         │  └──────────────────┘   │
         └─────────────────────────┘
```

---

## Componentes

### 1. Postgres (Railway)

**Imagem:** `ghcr.io/railwayapp-templates/postgres-ssl:17`
**Volume:** `pgdata` (persistente, sobrevive a restarts)
**Tabelas:**
- `agent_configs` — config do agente (1 linha por `agent_type`)
- `agent_skills` — habilidades modulares
- `chat_messages` — histórico completo
- `chat_control` — pause/resume IA por sessão
- `message_buffer` — buffer de debounce

**Schema da Evolution:** isolado em `schema=evolution` (definido em `DATABASE_CONNECTION_URI`). Sem conflito.

### 2. Evolution API (Railway)

**Imagem:** `evoapicloud/evolution-api:v2.3.7`
**Função:** ponte entre WhatsApp Web (Baileys) e nosso agente.
**Webhook:** registrado automaticamente pelo agente no boot — aponta pra `${PUBLIC_URL}/webhooks/evolution` com eventos `MESSAGES_UPSERT` e `MESSAGES_UPDATE`.
**Auth:** via `apikey` header. Key auto-gerada no deploy do template.

### 3. Agente Node (Railway)

**Stack:** TypeScript + Fastify + pg + OpenAI SDK.
**Boot sequence:**
1. `npm run boot` → roda `db/migrate.js` → roda `server.js`.
2. `migrate.js`: aplica `schema.sql` (idempotente) + bootstrap de `agent_configs` se vazio.
3. `server.js`: sobe Fastify, registra webhook routes + qr routes + health.
4. Após o servidor estar listening: dispara `bootstrapEvolution()` em background — aguarda Evolution responder, cria/atualiza instância com webhook apontando pra si mesmo.

**Rotas:**
- `GET /health` — uptime + timestamp
- `GET /health/ready` — pinga o Postgres
- `GET /qr` — HTML auto-refresh com QR Code
- `GET /qr/state` — JSON com estado da conexão (`open` / `connecting` / `close`)
- `GET /qr/image` — JSON com base64 do QR atual + pairing code
- `POST /webhooks/evolution` — recebe eventos da Evolution (mensagens)

**Fluxo de uma mensagem do usuário:**

```
1. WhatsApp → Evolution
2. Evolution → POST /webhooks/evolution (agente)
3. Agente: parse + persist em chat_messages + insert em message_buffer
4. Debounce timer (15s padrão) — agrupa mensagens curtas
5. Flush:
   - Carrega config + skills do DB (cache 30s)
   - Constrói system prompt (config.system_prompt + <skills>...)
   - Carrega histórico (últimas 30 mensagens)
   - Chama OpenAI com response_format=json_schema (mensagens[2..5])
   - Persiste cada mensagem em chat_messages com status=pending
   - Pra cada uma: sendPresence(composing) → delay typing_ms → sendText → mark sent
6. Webhook from_me da Evolution promove pending→sent ao receber confirmação
```

### 4. Claude Code desktop + MCP Postgres

**Conexão:** stdio MCP server `@henkey/postgres-mcp-server` (npm), configurado em `.mcp.json` da pasta do aluno.
**Acesso:** `DATABASE_PUBLIC_URL` (TCP proxy da Railway, externo).
**Capabilities:** SELECT/INSERT/UPDATE/DELETE em qualquer tabela. Aluno fala em PT, Claude Code traduz pra SQL.

---

## Decisões de design

### Por que Postgres único compartilhado entre Evolution e Agente?

**Pro:** corta um serviço. Aluno paga 1 Postgres no Railway em vez de 2.
**Contra:** se quiser separar produção em escala, dá trabalho dividir.
**Mitigação:** Evolution usa schema `evolution`, agente usa `public`. Migrations isoladas.

### Por que MCP em vez de endpoints HTTP de admin?

**Pro:**
- Zero código de admin pra manter.
- Aluno tem **poder pleno** (debug, query histórica, ajustes ad-hoc).
- 1 secret pra colar (`DATABASE_URL`) em vez de 2 (URL + token).

**Contra:**
- DATABASE_URL com senha precisa cuidado pra não vazar (`.gitignore`).
- Sem auth granular — quem tem URL tem tudo.

**Mitigação:** Railway TCP proxy é firewall externo. URL é exposta só pelo aluno. CLAUDE.md instrui Claude Code a confirmar antes de DELETE/DROP.

### Por que skills em DB e não em arquivos?

**Pro:**
- Edita ao vivo, sem redeploy (3-5 min de espera).
- 1 fonte da verdade.
- Aluno não precisa entender git/deploy.

**Contra:**
- Aluno não "vê" os arquivos físicos.

**Mitigação:** Claude Code mantém **espelho local** em `skills/*.md` quando cria/edita. Aluno enxerga, mas DB manda.

### Por que skills carregadas todas no system prompt em v1?

**Pro:** simples, baixa latência, sem extra round trip.
**Contra:** com 30+ skills, eats tokens fast.
**Plano v2:** skill discovery via tool calling — agente vê só `description`, pede `content` da que precisa.

### Por que cache de 30s?

**Pro:** evita 1 query no Postgres a cada turno (que pode ter 100s/min).
**Contra:** edição leva ≤30s pra ativar.
**Trade-off aceito:** 30s é tolerável pro aluno editando, e poupa muita query.

---

## Limitações conhecidas

1. **Evolution = não oficial** — risco de ban Meta. Aluno deve usar chip dedicado.
2. **Vídeo não é processado** — feature do repo original (Gemini) foi removida pra cortar uma chave.
3. **Sem multi-tenant** — 1 deploy = 1 agente. Pra múltiplos agentes, deploys separados.
4. **Sem rate limiting nativo** — agente confia que ninguém vai dar flood. Em produção real, adicionar rate limit por session_id.
5. **Sem retries da OpenAI** — falha de OpenAI vira mensagem de erro pro usuário. Pode adicionar retries com backoff.

---

## Como evoluir

Linhas naturais de extensão:

- **Skill discovery via tool calling** (v2)
- **Multi-agente** (lead qualifier vs suporte) — usa `chat_control.agent_type` que já existe
- **Webhook outbound** quando agente fecha venda / qualifica lead → CRM
- **Dashboard de conversas** (Next.js standalone que lê do Postgres)
- **Agendamento via Google Calendar API**
- **Knowledge base externa** (RAG via pgvector — já dá pra adicionar no schema)
