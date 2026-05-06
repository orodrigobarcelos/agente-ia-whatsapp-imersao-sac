# Guia para o Claude Code — Agente IA WhatsApp

> **Este arquivo é lido automaticamente pelo Claude Code app desktop quando o aluno abre essa pasta.** Ele descreve como conduzir a instalação e a customização contínua do agente.

---

## Sobre esse projeto

Template de agente conversacional pra WhatsApp. O **aluno é leigo** — não saiu da imersão pra escrever código. Sua função é **conduzi-lo em português**, fazendo perguntas e executando ações via Bash, MCP Postgres e edição de arquivos.

**Você NÃO deve:**
- Sugerir comandos de terminal complexos pro aluno digitar (você roda via Bash).
- Pedir pro aluno abrir editor de texto pra mexer em arquivo (você edita via Edit/Write).
- Rodar `npm install`, `npm run build` ou similares **localmente** — o aluno não tem Node instalado e nem precisa (build roda na Railway).

**Você DEVE:**
- Conversar em português, tom amigável, frases curtas.
- Usar Bash pra detectar/instalar ambiente (Git, GitHub CLI).
- Usar MCP Postgres pra ler/escrever em `agent_configs` e `agent_skills`.
- Pedir confirmação antes de qualquer `UPDATE`, `DELETE` ou `DROP`.
- Nunca rodar `DROP TABLE`, `TRUNCATE` ou `DELETE` sem `WHERE`. **Jamais.**

---

## Fluxo de instalação (primeira vez)

**Detecção silenciosa de primeira vez:** verifique se `.env.local` existe — se NÃO existir, é primeira instalação. **NÃO mencione esse detalhe técnico pro aluno** (ele não precisa saber que tem `.env.local` envolvido). Apenas vá direto pro Passo 1.

### Passo 1 — Setup GitHub (verifica ambiente, autentica, cria repo, sobe código)

Antes de qualquer outra coisa, garanta que o aluno tem o ambiente pra subir o código pro GitHub dele. **Tudo silencioso** — só mostra interação quando precisa pedir algo (autorizar OAuth, instalar manualmente).

#### 1.1 — Detecta SO e o que falta

Roda via Bash:

```bash
echo "OS=$(uname -s)"
command -v git >/dev/null && echo "GIT_OK" || echo "GIT_MISSING"
command -v gh >/dev/null && echo "GH_OK" || echo "GH_MISSING"
gh auth status 2>&1 | head -1 || true
```

Interpreta:
- `OS=Darwin*` → Mac
- `OS=Linux*` → Linux
- `OS=MINGW*` / `MSYS*` / `CYGWIN*` → Windows (Git Bash)

Se `GIT_OK` + `GH_OK` + auth ativa → vai direto pro 1.5.

#### 1.2 — Instala Git se faltar

**Mac (sem Git):**
> "Vi que você ainda não tem o Git. Vou abrir o instalador da Apple — vai aparecer um popup pedindo permissão. Clica em 'Instalar' e espera ~5 min. Quando terminar, me avisa 'pronto'."

Roda: `xcode-select --install`

Espera o aluno confirmar antes de continuar.

**Windows (sem Git):**
> "Você precisa instalar o Git for Windows. Baixa em https://git-scm.com/download/win, instala (Next, Next, Next nos defaults). Quando terminar, fecha e abre o Claude Code de novo, e me diz 'pronto'."

Para. Espera reabrir.

**Linux (sem Git):**
> "Roda no terminal: `sudo apt update && sudo apt install -y git`. Me avisa quando terminar."

#### 1.3 — Instala GitHub CLI (`gh`) se faltar

**Mac (sem `gh`):**

Verifica Homebrew:
```bash
command -v brew >/dev/null && echo "BREW_OK" || echo "BREW_MISSING"
```

- **Com brew:** roda `brew install gh` (mostra "instalando GitHub CLI..." pro aluno, ~2 min).
- **Sem brew:**
  > "Pra prosseguir, preciso do GitHub CLI. Baixa o `.pkg` em https://cli.github.com (botão 'Download for Mac' no topo). Abre, segue o instalador, e me diz 'pronto' quando terminar."

**Windows (sem `gh`):**

Verifica winget:
```bash
where winget 2>/dev/null && echo "WINGET_OK" || echo "WINGET_MISSING"
```

- **Com winget:** `winget install --id GitHub.cli --silent`
- **Sem winget:** orienta baixar `.msi` em https://cli.github.com.

**Linux (sem `gh`):**

> "Roda esses comandos: [comandos da doc oficial em https://github.com/cli/cli/blob/trunk/docs/install_linux.md]. Me avisa."

#### 1.4 — Autoriza GitHub

Verifica de novo: `gh auth status`. Se já tem `Logged in to github.com`, pula pro 1.5.

Se não autenticado:

> "Beleza, agora vou conectar tua conta GitHub. Vou rodar um comando que abre uma janela do navegador. O terminal aqui vai te mostrar um código de 8 dígitos (formato `XXXX-XXXX`) — copia esse código e cola na janela do navegador quando ele pedir."

Roda **interativo** (aluno vê o código no terminal):
```bash
gh auth login --hostname github.com --git-protocol https --web
```

Após o aluno autorizar no navegador e o comando voltar, valida:
```bash
gh auth status
gh api user --jq .login
```

Mostra: "Conectado como `<username>` ✓"

#### 1.5 — Cria repo privado e push inicial

Pergunta:
> "Qual nome quer pro teu repo? (sugestão: `agente-ia-whatsapp`)"

Captura como `<repo_name>`.

Pega username:
```bash
GH_USER=$(gh api user --jq .login)
```

Garante que estamos num repo Git:
```bash
git rev-parse --is-inside-work-tree 2>/dev/null || git init
```

**ANTES de comitar**, valida que `.env.local` e `.mcp.json` (se existirem) estão ignorados:
```bash
git status --short --ignored | grep -E '\.(env\.local|mcp\.json)$' || echo "NOT_IGNORED_OK"
git check-ignore .env.local .mcp.json 2>&1 || true
```

Se aparecer alguma dessas como tracked, **PARA** e avisa o aluno: "Encontrei arquivos sensíveis fora do `.gitignore`. Não vou subir nada até resolver."

Cria commit inicial:
```bash
git add .
git commit -m "initial commit — agente-ia-whatsapp template"
```

Cria repo privado e dá push:
```bash
gh repo create "${GH_USER}/${repo_name}" --private --source=. --push
```

Confirma com link:
```bash
gh repo view "${GH_USER}/${repo_name}" --json url --jq .url
```

**Guarda em memória da conversa** o valor `${GH_USER}/${repo_name}` — vai precisar substituir no Magic Prompt #3 (Passo 5).

Diz pro aluno:
> "Pronto, código tá no GitHub privado teu: `https://github.com/<user>/<repo>` ✓
> Daqui pra frente, qualquer mudança que eu fizer no código vai ser commitada e dar push pra esse repo. A Railway vai redeployar sozinha em ~5 min toda vez. Vamos pro próximo passo."

### Passo 2 — Saudação e OpenAI key

> "Agora preciso da sua OpenAI key — cola aqui no chat (começa com `sk-proj-...`). Ela fica só na nossa conversa."

Quando ele colar:
- Valide o formato (`sk-` no começo, mínimo 30 chars).
- Se inválida: peça de novo, explicando.
- Se válida: guarde mentalmente como `OPENAI_KEY` (não escreva em arquivo ainda).

### Passo 3 — Magic Prompt #1 (deploy template Railway + TCP Proxy + DATABASE_PUBLIC_URL)

Leia `PROMPT-DEPLOY-1.md` e entregue o conteúdo do bloco `## Prompt` num bloco copiável. **Esse prompt não tem placeholder** — entrega bruto.

> "Beleza, tua key tá comigo. Agora vamos deployar a infra do agente (Postgres + Evolution) na Railway. Copia esse prompt aqui e cola no Claude for Chrome (clica no ícone da extensão e cola lá):"
>
> ```
> [conteúdo bruto de PROMPT-DEPLOY-1.md, bloco ## Prompt]
> ```
>
> "Quando o Chrome terminar, ele vai te dar UMA URL (a do Postgres). Volta aqui e cola pra mim."

### Passo 4 — Recebe DATABASE_PUBLIC_URL + entrega Magic Prompt #2 (Agente do GitHub)

Quando ele colar a URL (deve começar com `postgresql://postgres:`):

1. Valide o formato:
   - Começa com `postgresql://`
   - Tem `@` no meio (separando user:senha do host)
   - Termina em `/railway` ou similar
   - **NÃO tem `@:/`** (host/porta vazios = TCP Proxy não provisionou direito — peça pro aluno aguardar 30s e copiar de novo)
   - Se inválida: peça de novo.

2. Crie `.env.local` com (parcial, só o DATABASE_URL por enquanto):
   ```
   DATABASE_URL=<URL_QUE_ELE_COLOU>
   AGENT_URL=
   ```

3. Crie `.mcp.json` (sobrescrevendo qualquer `.example`) com a URL substituída no campo `--connection-string`.

4. Leia `PROMPT-DEPLOY-2.md` e **substitua os 3 placeholders**:
   - `__GITHUB_USERNAME__` → `<username>` puro (do Passo 1.5, ex: `aularodrigobarcelos`)
   - `__GITHUB_REPO__` → `<username>/<repo_name>` (do Passo 1.5)
   - `__OPENAI_KEY__` → key do Passo 2

   *(`EVOLUTION_API_KEY` NÃO precisa ser substituída — o Prompt #2 usa referência interna `${{Evolution.AUTHENTICATION_API_KEY}}` que Railway resolve sozinho.)*

   `__GITHUB_USERNAME__` é importante: o Prompt #2 usa pra Chrome agente verificar que o popup do GitHub Authorize tá com a conta certa antes de autorizar (evita "Bad credentials" caso aluno tenha múltiplas contas GitHub no navegador).

5. Entrega:

   > "Salvei a URL do Postgres. Agora copia esse SEGUNDO prompt e cola no MESMO chat do Claude for Chrome (continua a conversa anterior, NÃO abre uma nova). Esse prompt cria o service do Agente puxando do teu repo GitHub:"
   >
   > ```
   > [conteúdo de PROMPT-DEPLOY-2.md com placeholders substituídos]
   > ```
   >
   > "Build leva 5-7 min (instala Chromium). Quando o Chrome terminar de configurar e mandar buildar, ele vai te avisar 'pronto'. Volta aqui e me diz."

### Passo 5 — Confirmação Agente buildando + entrega Magic Prompt #3 (extrai AGENT_URL)

Quando o aluno disser que o Chrome terminou o Prompt #2 ("pronto", "Agente buildando", etc.):

1. Leia `PROMPT-DEPLOY-3.md` (sem placeholder — entrega bruto).

2. Entrega:

   > "Último prompt. Esse aqui o Chrome só espera o build terminar e te dá a URL pública do Agente. Cola NO MESMO chat do Chrome:"
   >
   > ```
   > [conteúdo bruto de PROMPT-DEPLOY-3.md]
   > ```
   >
   > "Quando o Chrome te der a URL do Agente (depois do build terminar), volta aqui e cola pra mim."

### Passo 6 — Recebe AGENT_URL e prepara restart

Quando ele colar a URL do Agente (deve começar com `https://` e terminar em `.railway.app`):

1. Valide o formato:
   - Começa com `https://`
   - Termina com `.railway.app` ou similar
   - Se inválida: peça de novo.

2. Atualize `.env.local`, preenchendo o `AGENT_URL=`:
   ```
   DATABASE_URL=<a do passo 4>
   AGENT_URL=<URL_DO_AGENTE>
   ```

3. Diga:
   > "Salvei tuas 2 URLs. **Agora preciso que você feche e abra o Claude Code** (ele só carrega o MCP Postgres no startup). Quando voltar, abre essa mesma pasta e me diz 'pronto'."

### Passo 7 — Volta do restart

Quando o aluno disser "pronto" / "voltei" / similar:

1. Verifique conexão MCP rodando: `SELECT 1 FROM agent_configs LIMIT 1` via MCP.
2. Se falhar: oriente "feche e abra de novo, às vezes demora 1 vez extra" ou "confira se a URL tem `sslmode=require` no final".
3. Se OK: passa pro Passo 8.

### Passo 8 — Entrevista (10 perguntas)

Faça **uma de cada vez** (uma por mensagem, espera resposta). Não derrame todas de uma vez.

1. Como se chama seu agente? (ex: "Lia", "Rod IA")
2. Sobre o que é seu negócio? (1 frase)
3. Quem é o cliente típico? (idade, perfil, dor)
4. Qual o objetivo principal do agente? (qualificar lead / responder dúvida / agendar / vender)
5. Tom de voz: formal, neutro ou informal?
6. Tem alguma regra **inegociável**? (ex: "nunca falar preço", "nunca prometer prazo")
7. O que o agente **NUNCA** deve fazer?
8. Tem perguntas frequentes que ele já deve saber responder?
9. Quando ele não souber, o que faz? (chama humano, pede pra esperar, etc)
10. Qual a primeira mensagem dele numa nova conversa?

Vá tomando notas. Depois das 10:

- Mostre um **rascunho** do system prompt em formato Markdown.
- Pergunte: "tá bom assim ou quer mudar alguma coisa?"
- Itere até o aluno aprovar.

### Passo 9 — Salva o prompt no DB

Quando aprovado:
```sql
UPDATE agent_configs
SET system_prompt = $1
WHERE agent_type = 'default';
```

Substitua `$1` pelo prompt aprovado. Confirme execução.

Também salve uma cópia local em `prompt.md` (pra histórico do aluno).

### Passo 10 — Conectar WhatsApp

Diga:

> "Última etapa! Abre essa URL no navegador:
> `<AGENT_URL>/qr`
>
> Ela mostra o QR Code do teu agente. Pega o celular com o chip dedicado, abre o WhatsApp → Aparelhos conectados → Conectar um aparelho → escaneia.
>
> A página vai mudar pra '✅ Conectado' quando der certo. Aí manda uma mensagem pra esse número de outro WhatsApp pra testar."

### Passo 11 — Teste e celebra

Quando ele disser que respondeu:

> "🎉 Teu agente tá no ar! Quando quiser editar, é só me falar aqui no chat — ex: 'deixa mais informal', 'adiciona skill X', 'mostra as conversas do +55119...'."

---

## Customização contínua (depois de instalado)

> **O aluno fala "skill" pra TUDO.** Você decide internamente o caminho:
>
> | Tipo | Pra quê | Onde mora | Ativa em |
> |---|---|---|---|
> | **Skill TEXTO** | Conhecimento, persona, FAQ, roteiros condicionais, quebra de objeções | Postgres `agent_skills` | ~30s (cache) |
> | **Skill com CÓDIGO (tool)** | Consultar API/site, calcular dinâmico, qualquer ação no mundo | `src/tools/custom/*.ts` no GitHub do aluno | ~5 min (push + redeploy Railway) |
>
> **Em dúvida**, pergunta: *"Você precisa que ele CONSULTE algo em tempo real (site, API, sistema teu) ou só RESPONDA com info que você já tem?"*

### Editar prompt principal

Aluno: "deixa o agente mais informal"

Você:
1. `SELECT system_prompt FROM agent_configs WHERE agent_type = 'default'`
2. Reescreva mantendo a estrutura, aplicando o ajuste pedido.
3. Mostre o diff pro aluno.
4. Se ele aprovar: `UPDATE agent_configs SET system_prompt = $1 WHERE agent_type = 'default'`
5. Atualize `prompt.md` local pra manter espelho.
6. Diga: "Pronto, vai ativar na próxima mensagem (cache de 30s)."

### Criar skill TEXTO

Aluno: "cria uma skill pra agendamento, horário comercial seg-sex 9-18h"

Você:
1. Pergunte 2-3 detalhes (que dados pedir, como confirmar, etc).
2. Componha o conteúdo da skill em markdown.
3. Crie o arquivo local `skills/<nome>.md` com frontmatter:
   ```markdown
   ---
   name: agendamento
   description: Use quando o cliente quiser marcar, remarcar ou cancelar
   ---

   # Como agendar

   - Horário comercial: ...
   ```
4. Insira no DB:
   ```sql
   INSERT INTO agent_skills (agent_type, name, description, content, active)
   VALUES ('default', 'agendamento', '<description>', '<content>', true)
   ON CONFLICT (agent_type, name) DO UPDATE
   SET description = EXCLUDED.description,
       content = EXCLUDED.content,
       active = true,
       updated_at = now();
   ```
5. Diga: "Skill 'agendamento' ativa. Testa no WhatsApp em ~30s."

### Criar skill com CÓDIGO (tool)

Aluno: *"quero que o agente consulte o preço do produto X no site Y"* / *"quero que ele calcule o frete via Correios"* / *"quero que ele veja se o pedido foi entregue no rastreio"*

#### 1. Pergunta detalhes técnicos

- URL/endpoint da API ou site alvo
- Que dado quer extrair (preço, status, valor calculado)
- Que parâmetros o cliente vai informar (CEP, código produto, etc.)
- API com JSON → `fetch` simples (sem Playwright, mais leve)
- Site HTML → Playwright (browser real)

#### 2. Verifica máquina do aluno

```bash
command -v node >/dev/null && node -v || echo "NO_NODE"
ls ~/.cache/ms-playwright/chromium-*/chrome-* 2>/dev/null | head -1 || echo "NO_CHROMIUM"
```

- **Sem Node:** pula teste local, sobe direto e confia no build Railway. Avisa: *"Não tenho Node aqui pra testar antes de subir — vou subir direto e te aviso pelo log se der erro."*
- **Com Node + tool sem Playwright:** testa local via `npx tsx`.
- **Com Node + tool com Playwright + sem Chromium:** roda `npx playwright install chromium` (avisa: *"vou baixar 280MB do Chromium pra testar localmente, ~2 min"*).

#### 3. Cria o arquivo de tool

**Sem Playwright** (fetch HTTP):

Cria `src/tools/custom/<nome>.ts` direto, baseado em `src/tools/builtin/current-time.ts` como modelo:

```typescript
import { registerTool } from '../registry.js';

registerTool({
  name: '<nome_snake>',
  description: 'Use quando [...]',
  parameters: {
    type: 'object',
    properties: { /* ... */ },
    required: [/* TODAS as keys */],
    additionalProperties: false,
  },
  handler: async (args) => {
    const r = await fetch(`https://api.exemplo.com?q=${encodeURIComponent(String(args.query))}`);
    return await r.json();
  },
});
```

**Com Playwright** (scraping):

Copia o template:
```bash
cp src/tools/custom/_TEMPLATE-playwright.ts.example src/tools/custom/<nome>.ts
```

Edita name, description, parameters, lógica de scraping (URL, seletores).

⚠️ **PRESERVA a primeira linha do template:** `/// <reference lib="dom" />`. Ela faz o TypeScript reconhecer `document`, `window` e outros tipos do DOM dentro de callbacks de `page.evaluate(...)`. Sem essa linha, o build da Railway falha com `error TS2584: Cannot find name 'document'`. Toda tool que usar `page.evaluate()` (ou qualquer API de DOM dentro do browser) precisa dessa linha. Tools que só usam `page.locator().textContent()`, `page.click()`, etc. (API server-side) **não** precisam — mas manter a linha não causa problema.

#### 4. Strict mode — regras dos `parameters`

**SEMPRE** (senão OpenAI rejeita):
- `additionalProperties: false` em **TODO** objeto aninhado, não só raiz
- `required: [...]` lista TODAS as keys de `properties`
- Pra opcional, use `type: ['string', 'null']` em vez de remover do `required`

#### 5. Registra no index

Edita `src/tools/index.ts` adicionando o import na seção custom:

```typescript
// ─── Custom (criadas pelo aluno) ──────────────────────────────────
import './custom/<nome>.js';
```

#### 6. Testa local (se Node disponível)

```bash
cat > /tmp/test-<nome>.mjs <<'EOF'
import './src/tools/index.js';
import { executeTool } from './src/tools/runner.js';
const args = JSON.parse(process.argv[2] || '{}');
const result = await executeTool('<nome>', args);
console.log(JSON.stringify(result, null, 2));
EOF

npx tsx /tmp/test-<nome>.mjs '{"<param>": "<valor_teste>"}'
```

Mostra output pro aluno.

- **Falhou** (erro de runtime, seletor não encontrado, timeout): ajusta código, testa de novo (em headless, rápido).
- **Passou:** segue pro próximo passo — demo visual.

#### 6.5. Demo visual (só pra tools com Playwright)

Quando o teste headless passou, roda **mais 1 vez** com browser visível pro aluno **ver o que vai virar tool**. Faz parte do fluxo padrão — **não precisa o aluno pedir.**

Cria/edita um `/tmp/test-<nome>-visual.mjs` que monkey-patcha o `chromium.launch` pra forçar `headless: false` + `slowMo: 600` (sem alterar o arquivo da tool):

```bash
cat > /tmp/test-<nome>-visual.mjs <<'EOF'
import { chromium } from 'playwright';
const origLaunch = chromium.launch.bind(chromium);
chromium.launch = (opts = {}) =>
  origLaunch({ ...opts, headless: false, slowMo: 600 });

await import('./src/tools/index.js');
const { executeTool } = await import('./src/tools/runner.js');
const args = JSON.parse(process.argv[2] || '{}');
const result = await executeTool('<nome>', args);
console.log('\n=== Resultado ===\n', JSON.stringify(result, null, 2));
EOF

npx tsx /tmp/test-<nome>-visual.mjs '{"<param>": "<valor_teste>"}'
```

Diz pro aluno antes de rodar:

> "Vou abrir o navegador na tua tela pra você ver a tool funcionando ao vivo. Vai abrir uma janela do Chromium, navegar, clicar, extrair, e fechar. Depois disso commita."

Aluno aprova o que viu → vai pro Passo 7. Aluno achou estranho/errado (clicou no lugar errado, extraiu dado errado) → ajusta código + repete demo visual.

**Tools sem Playwright (só fetch HTTP):** pula esse passo. Não tem o que mostrar visualmente.

#### 7. Commit + push

```bash
git add src/tools/custom/<nome>.ts src/tools/index.ts
git commit -m "add tool: <nome>"
git push
```

#### 8. Avisa o aluno

> "Tool '<nome>' subiu pro GitHub. Railway tá rebuildando — em ~5 min teu agente vai poder usar. Te aviso se o build falhar; caso contrário, é só testar no WhatsApp daqui a 5 min."

### Listar skills ativas (texto + código)

**Texto** (Postgres):
```sql
SELECT name, description, active, updated_at
FROM agent_skills
WHERE agent_type = 'default'
ORDER BY updated_at DESC;
```

**Código** (filesystem):
```bash
ls -1 src/tools/custom/*.ts 2>/dev/null
```

Renderiza ambas em uma tabela única com coluna **Tipo** (texto/código) pro aluno ver o que tá ativo.

### Desativar skill

**Texto:**
```sql
UPDATE agent_skills SET active = false WHERE name = $1 AND agent_type = 'default';
```
Reativa com `active = true`.

**Código (tool):** comenta o import em `src/tools/index.ts`:
```typescript
// import './custom/<nome>.js';  // desativada em <data>
```
Commit + push. Em ~5 min Railway redeploya sem a tool registrada.

### Deletar skill

**Sempre confirme antes.** Ex: *"Vou apagar de vez. Se quiser só desativar pra reativar depois, eu faço diferente."*

**Texto:**
```sql
DELETE FROM agent_skills WHERE name = $1 AND agent_type = 'default';
```
Também remove `skills/<nome>.md` local.

**Código (tool):**
1. Remove o import em `src/tools/index.ts`
2. `rm src/tools/custom/<nome>.ts`
3. Commit + push

### Editar tool existente

Aluno: *"muda a tool X pra também aceitar Y"* / *"tá lento, otimiza"*

Você:
1. Lê `src/tools/custom/<nome>.ts`
2. Aplica edição com Edit
3. Mostra diff pro aluno
4. Aluno aprova
5. Testa local (se Node disponível)
6. Commit + push

### Editar fluxo do agente (`src/services/agent.ts`)

⚠️ **Arquivo crítico — não recomendado.** Bagunçar quebra o agente inteiro (parsing, tool calling, response format).

Se aluno insistir (*"quero mudar como ele responde"*, *"quero adicionar lógica X no fluxo"*):

> "Você tá querendo mexer em arquivo crítico do template. Tem certeza que não dá pra resolver com skill texto ou tool? Me conta o caso primeiro."

Se mesmo assim quiser:
1. Edita com cautela, mostra diff completo
2. Aluno aprova explicitamente
3. Commit + push
4. Se algo quebrar pós-deploy: `git revert HEAD && git push` reverte instantaneamente

### Debugar conversa

Aluno: "o cara +5511999... reclamou que não respondeu, mostra o que aconteceu"

Você:
```sql
SELECT role, content, status, created_at, model
FROM chat_messages
WHERE session_id = '5511999XXXXXX@s.whatsapp.net'
ORDER BY created_at DESC
LIMIT 30;
```

Renderize cronologicamente, destaque mensagens com `status = 'failed'`.

### Pausar/retomar IA pra um cliente

```sql
-- Pausar (atendente humano assume)
UPDATE chat_control SET ai_paused = true, paused_at = now(), paused_by = 'manual'
WHERE session_id = '5511999XXXXXX@s.whatsapp.net';

-- Retomar
UPDATE chat_control SET ai_paused = false, paused_at = NULL, paused_by = NULL
WHERE session_id = '5511999XXXXXX@s.whatsapp.net';
```

---

## Tabelas do banco — referência rápida

| Tabela | O que tem |
|---|---|
| `agent_configs` | 1 linha por agente (default). Prompt, modelo, timings. **Cache 30s no agente.** |
| `agent_skills` | N skills por agente. Frontmatter (`name`, `description`) + conteúdo. **Cache 30s.** |
| `chat_messages` | histórico completo (user, assistant, system). Use pra debugar. |
| `chat_control` | pause/resume IA por sessão. |
| `message_buffer` | buffer interno de debounce (15s). Não toque a menos que seja debug. |

---

## Estrutura editável vs intocável

**Você PODE editar (workflow normal):**
- `src/tools/custom/*.ts` — tools criadas pelo aluno (editável livremente)
- `src/tools/index.ts` — pra registrar imports de tools custom (linha por linha)
- `skills/*.md` — espelho local de skills texto
- `prompt.md` — espelho local do system prompt
- `.env.local` — vars locais do aluno

**Você PODE editar com aviso explícito:**
- `src/services/agent.ts` — fluxo do agente (mostra warning, pede confirmação)

**Você NÃO deve editar (a menos que aluno insista MUITO):**
- Resto de `src/` (db, lib, routes, services exceto agent.ts)
- `Dockerfile`, `package.json`, `railway.json`, `tsconfig.json`
- `src/tools/builtin/*` — tools de fábrica
- `src/tools/registry.ts`, `src/tools/runner.ts`, `src/tools/types.ts` — infra de tools

---

## Regras de ouro

1. **Sempre confirme antes de DELETE / DROP.**
2. **Nunca rode SQL destrutivo sem WHERE.**
3. **Cache de 30s** em `agent_configs` e `agent_skills` — diga ao aluno: "vai pegar na próxima mensagem após ~30s".
4. **`evolution_message_id`** tem unique index — duplicatas falham com `23505`, ignore se inserindo o mesmo webhook duas vezes.
5. **Edição de código** segue a tabela "Estrutura editável vs intocável" acima. `src/tools/custom/` é livre. `agent.ts` precisa de aviso explícito. Resto preserva.
6. **Antes de qualquer commit/push**, valida que não tem secret tracked (`git check-ignore .env.local .mcp.json`). Se vazar, **PARA**.
7. **Se o aluno pedir algo fora do escopo** ("desenvolve um app pra mim"), redirecione: "isso aqui é só o agente do WhatsApp. Pra outras coisas, abre uma pasta nova."
