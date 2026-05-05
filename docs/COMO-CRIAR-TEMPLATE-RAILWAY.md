# Como criar o template público na Railway (passo a passo pro Rodrigo)

> **Este arquivo é só pra você, Rodrigo.** Não vai pro aluno.

O objetivo: transformar o projeto Railway atual num **botão "Deploy on Railway"** que o aluno clica e em ~5min sobe Postgres + Evolution + Agente já amarrados.

---

## Estado atual (atualizado após sessão de 05/maio/2026)

- ✅ **Etapa 1** — Repo publicado: https://github.com/orodrigobarcelos/agente-ia-whatsapp-imersao-sac
- ✅ **Etapa 2** — `railway.template.json` aponta pro repo correto.
- ✅ **Etapa 3.1** — Projeto-modelo `strong-playfulness` criado e validado funcional na Railway (3 serviços rodando, mensagem WhatsApp testada e respondida pelo agente).
- ⏳ **Etapa 3.2** — Promover projeto a Template público (você está aqui).
- ⏳ **Etapa 3.3** — Testar em janela anônima.
- ⏳ **Etapa 4** — Atualizar `PROMPT-DEPLOY.md` com URL real do template.

---

## Pré-requisitos

- [x] Repo público no GitHub
- [x] Conta Railway com plano Hobby (Free não permite templates públicos com volumes)
- [x] Logado em [railway.com](https://railway.com)
- [x] Projeto `strong-playfulness` rodando OK

---

## ⚠️ Lições aprendidas na sessão de bring-up (LEIA ANTES)

Estes são os 7 bugs que pegaram no setup manual. Tudo já está consertado no código + `railway.template.json` no repo, mas anote pra não cair de novo se for refazer manualmente:

| # | Pegadinha | Sintoma | Fix |
|---|---|---|---|
| 1 | Image `atendai/evolution-api` está abandonada | Bugs antigos do WhatsApp protocol | Use **`evoapicloud/evolution-api:v2.3.7`** |
| 2 | `CONFIG_SESSION_PHONE_VERSION` hardcoded | Conecta mas não recebe eventos | **Não defina** — Baileys descobre sozinho |
| 3 | Evolution sem Redis | Spam `[Redis] disconnected`, mensagens sumindo silenciosamente | `CACHE_REDIS_ENABLED=false` + `CACHE_LOCAL_ENABLED=true` |
| 4 | Volume Evolution no path errado | Auth WhatsApp some a cada deploy | Volume em **`/evolution/instances`** |
| 5 | Service names com case errado | `${{Postgres.DATABASE_URL}}` não resolve | Nomes **EXATOS**: `Postgres`, `Evolution`, `Agente` |
| 6 | Domain público não gerado antes de salvar envs | `PUBLIC_URL` fica vazia → webhook não registra | **Generate Domain** ANTES de colar envs |
| 7 | Port da Public Networking | Aluno troca pra 3000 sem entender | Railway define `PORT=8080` automaticamente, **não mexa** |

Estados zumbis a saber identificar:

- **Manager UI mostra "Connected" mas `state=close` na API** → Baileys morreu, conexão real caiu. Solução: chamar `POST /instance/restart/{instance}` e re-escanear QR.
- **`/qr/state` reportar `open` mas `sendText` retorna "Connection Closed"** → mesma coisa, Baileys zumbi. `restart` resolve.

---

## Etapa 3.2 — Promove o projeto a Template público

### Passo 1 — Acessa o menu de templates

1. No painel Railway, abre o projeto **`strong-playfulness`**.
2. Topo-direita: clica nos 3 pontinhos do nome do projeto (ou no nome do projeto → menu) → **Settings**.
3. Aba lateral: **Templates** (ou "Create Template" — depende da versão da UI).
4. Clica **Create Template from Project**.

### Passo 2 — Metadados

| Campo | Valor sugerido |
|---|---|
| **Name** | Agente IA WhatsApp — Imersão SAC |
| **Description** | Template plug-and-play de agente conversacional pra WhatsApp via Evolution API + OpenAI + Postgres. Customização via Claude Code app desktop + MCP Postgres. |
| **README** | Cole o conteúdo do `README.md` do repo (Railway exibe na página pública do template). |
| **Tags** | `whatsapp`, `ai`, `openai`, `evolution-api`, `chatbot`, `claude-code` |
| **Icon** | Usa o emoji 🤖 ou faz upload de um ícone PNG quadrado |
| **Category** | "Bots" ou "AI/ML" |

### Passo 3 — Configura cada serviço

Pra cada um dos 3 serviços (Postgres, Evolution, Agente), Railway vai listar **todas as variáveis de ambiente** que existem no serviço hoje. Você marca cada uma como uma das 3 categorias:

- 🔓 **Internal** → não aparece pro aluno, valor é fixado pelo template.
- ⌨️ **Required input** → aluno é obrigado a preencher na tela de deploy.
- 🟢 **Optional input** → aluno pode preencher ou deixar default.

#### Postgres

Marca **TODAS** as variáveis como **Internal**. Aluno não precisa ver nenhuma. Railway gera senha aleatória e referências automaticamente.

#### Evolution

Marca **TODAS** como **Internal**. Inclusive `AUTHENTICATION_API_KEY` (Railway gera random no `$RANDOM_SECRET`).

> **Verifica especialmente** que estas estão presentes (do que aprendemos hoje):
> - `CACHE_REDIS_ENABLED=false`
> - `CACHE_LOCAL_ENABLED=true`
> - **NÃO** tem `CONFIG_SESSION_PHONE_VERSION`
> - `DATABASE_CONNECTION_URI` termina com `?schema=evolution`

#### Agente

Aqui tem 2 vars que viram **input do aluno**:

| Variável | Categoria | Descrição mostrada ao aluno |
|---|---|---|
| `OPENAI_API_KEY` | **Required** | "Sua chave OpenAI (sk-proj-...). Mínimo US$ 5 de crédito na conta." |
| `AGENT_PROMPT_BOOTSTRAP` | **Optional** | "(Opcional) Prompt inicial do agente. Deixe vazio se for configurar depois via Claude Code + MCP Postgres." |

Todas as outras (`DATABASE_URL`, `EVOLUTION_*`, `PUBLIC_URL`, `NODE_ENV`, etc) → **Internal**.

### Passo 4 — Cross-service references

Railway deve detectar automaticamente as referências `${{Postgres.DATABASE_URL}}`, `${{Evolution.AUTHENTICATION_API_KEY}}`, `${{Evolution.RAILWAY_PRIVATE_DOMAIN}}`, `${{RAILWAY_PUBLIC_DOMAIN}}` e mostrar um aviso "X cross-service references detected". Confirma que todas estão sendo preservadas.

Se alguma não foi detectada, edita manualmente — clica na variável e o autocomplete `${{` abre o seletor.

### Passo 5 — Source de cada serviço

Confere:

- **Postgres** → image `ghcr.io/railwayapp-templates/postgres-ssl:17` (Railway preencheu sozinho)
- **Evolution** → image `evoapicloud/evolution-api:v2.3.7`
- **Agente** → repo `orodrigobarcelos/agente-ia-whatsapp-imersao-sac` branch `main`, `Auto Deploy: ON`

### Passo 6 — Volumes

Confere que estão preservados:

- **Postgres** → volume `pgdata` em `/var/lib/postgresql/data`
- **Evolution** → volume `evolution-volume` (ou nome que você deu) em `/evolution/instances`

### Passo 7 — Save & Publish

1. Clica **Publish** (ou **Save & Publish**).
2. Railway gera URL pública: algo tipo `https://railway.com/template/abc123XYZ`.
3. **Copia essa URL** — vai precisar nos próximos passos.

---

## Etapa 3.3 — Testa em janela anônima

### Antes de testar

Tenha em mãos:
- Outra OpenAI API key (ou a mesma — vai gastar uns centavos no teste)
- Outro chip de WhatsApp (ou o mesmo Business — desconecta da instância atual antes pra não bater)

### Roteiro

1. Abre **janela anônima**.
2. Cola a URL do template.
3. Login Railway (sua conta mesmo serve, vai criar projeto novo).
4. Cola a OpenAI key.
5. Clica **Deploy**.
6. Espera 3-5 min — Postgres → Evolution → Agente.
7. Pega `DATABASE_PUBLIC_URL` e URL pública do Agente.
8. Abre `<URL_AGENTE>/qr` → escaneia.
9. Manda mensagem 1-1 pro chip → vê resposta com placeholder ("oi! ainda estou sendo configurado").

Se chegou aqui: **✅ Template publicável.**

Se travou em algum passo, anota qual e me chama.

### Limpeza pós-teste

Vai no novo projeto Railway (do teste) → Settings → **Delete Project**. Não vai precisar pagar pelos serviços paralelos.

---

## Etapa 4 — Atualiza arquivos do kit com URL do template

Quando tiver a URL do template em mãos:

### 4.1. `PROMPT-DEPLOY.md` (obrigatório)

Substitui **as 2 ocorrências** de:

```
https://railway.com/template/SUBSTITUIR_PELO_SEU_TEMPLATE_ID
```

Pela URL real (ex: `https://railway.com/template/abc123XYZ`).

### 4.2. `README.md` (opcional mas bonito)

Adiciona o badge no topo:

```markdown
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/abc123XYZ)
```

Commit + push.

---

## Etapa 5 — Distribui pro aluno

Aluno só precisa de **1 link**: a URL do GitHub do repo (não a do template).

> "Vai aqui: https://github.com/orodrigobarcelos/agente-ia-whatsapp-imersao-sac — clica em **Code → Download ZIP**, extrai, abre a pasta no Claude Code, e diz *vamos instalar esse agente*."

O Claude Code lê `CLAUDE.md`, faz as 10 perguntas, te entrega o magic prompt pra colar no Claude for Chrome. O magic prompt é que tem a URL do **template Railway** dentro.

---

## Manutenção contínua

### Atualizar o template

Quando você fizer melhoria no código (`src/`):

1. Push pro GitHub.
2. Alunos novos clonam a versão atualizada **automaticamente** (template clona do `main` no momento do deploy de cada um).

Quando você fizer mudança em **env vars do template** (ex: novo flag obrigatório):

1. Atualiza `railway.template.json` no repo + commit.
2. Atualiza no projeto-modelo Railway também.
3. Vai em **Settings → Templates → Update**.
4. **Atenção:** alunos que JÁ deployaram não recebem update automático — eles ficam congelados na versão que clonaram. Se for breaking change, publica como **template novo** com versão (ex: "v2") em vez de sobrescrever.

### Métricas

Railway → seu projeto → Templates → mostra contador de deploys. Útil pra saber quantos alunos usaram.

---

## Troubleshooting comum

### "Build do Agente trava em `npm install`"

`package-lock.json` precisa estar commitado. Dockerfile usa `npm install` (sem `--frozen-lockfile`).

### "Evolution não responde / Manager UI 404"

Volume montado em `/evolution/instances`? Sem volume, restart perde estado e nunca termina de subir.

### "Manager UI mostra Connected mas mensagem não chega"

```bash
curl -s -H "apikey: <KEY>" https://<EVOLUTION_URL>/instance/connectionState/<INSTANCE>
```

Se retornar `state: close` → Baileys zumbi. Faz:

```bash
curl -X POST -H "apikey: <KEY>" https://<EVOLUTION_URL>/instance/restart/<INSTANCE>
```

E re-escaneia QR no `/qr` do agente.

### "Webhook não chega"

Public domain do Agente foi gerado? Sem ele, `PUBLIC_URL` fica vazia e bootstrap não registra webhook na Evolution.

### "Schema Postgres conflita"

`DATABASE_CONNECTION_URI` do Evolution **deve** terminar em `?schema=evolution`. Sem isso, Evolution tenta criar tabelas em `public` e bate com `agent_configs` etc.

### "1006 ao enviar"

Bug do código antigo (sem suporte `@lid`). Já corrigido nos commits `60728e7` + `9b23f1c`. Se aparecer em projeto novo, verifica que o repo no GitHub está atualizado.

### "Connection Closed ao enviar mesmo com state=open"

Mesmo do Baileys zumbi acima. `POST /instance/restart/<instance>` resolve.

---

## Resumo das pendências

- [x] Publicar repo no GitHub
- [x] Trocar placeholder do repo no `railway.template.json`
- [x] Projeto-modelo na Railway funcional
- [ ] **Promover a Template público na Railway** ← você está aqui
- [ ] Anotar a URL do template
- [ ] Atualizar `PROMPT-DEPLOY.md` (2 ocorrências)
- [ ] Atualizar `README.md` (badge opcional)
- [ ] Testar em janela anônima
- [ ] Distribuir link do GitHub pros alunos

Boa! 🚀
