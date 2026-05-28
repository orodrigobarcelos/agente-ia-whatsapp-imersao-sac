# Troubleshooting

Lista de problemas comuns durante a instalação e uso. Se nada aqui resolver, pede pro Claude Code: *"to com esse erro: [cola o erro]"*.

---

## Setup GitHub (Passo 1)

### "`gh` CLI não instala via `brew install gh`"

**Causa:** Homebrew não está instalado, ou `brew` falhou no caminho.

**Solução:** baixa o `.pkg` direto em https://cli.github.com (botão "Download for Mac"), instala manualmente, e diga "pronto" pro Claude Code.

---

### "`gh auth login` não abriu o navegador / código de 8 dígitos"

**Causa:** terminal sem `$BROWSER` configurado ou Claude Code rodando o comando em modo não-interativo.

**Solução:**
- Anota o código de 8 dígitos que aparece no terminal (formato `XXXX-XXXX`).
- Abre manualmente https://github.com/login/device no navegador.
- Cola o código.
- Autoriza Railway/CLI.
- Volta no Claude Code e digite "pronto" — ele continua o fluxo.

---

### "git push pediu usuário/senha"

**Causa:** `gh auth login` não configurou o credential helper.

**Solução:** roda no Bash:
```bash
gh auth setup-git
```
Aí refaz o push. `gh` vira o credential helper e usa o token gerado pelo OAuth.

---

### "Repo ficou público por engano"

**Sintoma:** abriu `github.com/<user>/<repo>` no anônimo e conseguiu ver o código.

**Solução IMEDIATA:**
1. Vai em `github.com/<user>/<repo>/settings`.
2. Rola até "Danger Zone" no fim.
3. "Change repository visibility" → "Private".
4. Confirma.
5. **Rotaciona segredos**: gera nova OpenAI key + nova `EVOLUTION_API_KEY` (substitui na Railway). O que vazou nos commits antigos pode ter sido scrapeado por bots.

---

### "Build do Agente na Railway demora muito"

**Sintoma:** ~5-7 min em "Building" / "Deploying".

**Não é falha.** O Dockerfile instala Chromium pro Playwright (~400MB extra). Tempo normal:
- Build: 4-6 min
- Deploy: 30s-1min
- Total: 5-7 min

Só considera falha se aparecer status vermelho "Failed" ou "Crashed". Se for OOM (out of memory) no build, considera fazer upgrade do plano Railway pra Hobby ($5/mês).

---

## Durante a instalação

### "Claude Code não vê o MCP Postgres"

**Sintoma:** rodo `/mcp` no Claude Code e não aparece `postgres-agente`, ou aparece mas com status `failed`.

**Causas e soluções:**

1. **Não reiniciei o Claude Code depois de criar o `.mcp.json`.**
   - Solução: feche completamente o app (Cmd+Q no Mac) e abra de novo. Reabra essa pasta.

2. **A `DATABASE_URL` no `.mcp.json` está errada.**
   - Solução: abre o arquivo `.mcp.json` no Finder, confere se a URL começa com `postgresql://postgres:` e tem uma porta no meio (ex: `:45780`). Se estiver vazia ou com `SUBSTITUIR_PELA_...`, peça pro Claude Code: *"corrige a DATABASE_URL no mcp.json"*.

3. **A senha tem caracteres especiais que estão quebrando.**
   - Solução: copia a `DATABASE_PUBLIC_URL` direto do painel Railway, **sem editar nada**. Cola no `.mcp.json` no lugar do antigo. Reinicia.

4. **O serviço Postgres da Railway está down.**
   - Solução: vai no painel Railway → Postgres → vê se status é "Active". Se "Crashed" ou "Building", espera ele subir.

---

### "Não acho a `DATABASE_PUBLIC_URL` no painel Railway"

**Sintoma:** Claude for Chrome (ou eu) não acha a variável.

**Solução:**

1. Vai em **Postgres** (no projeto Railway).
2. Aba **Variables**.
3. Procura `DATABASE_PUBLIC_URL`. Se não tiver:
   - Vai em **Settings** → **Networking** → liga **Public Networking** (TCP Proxy).
   - Volta em Variables — agora tem.

---

### "Evolution não conecta no Postgres"

**Sintoma:** logs do serviço Evolution mostram `connection refused` ou `database does not exist`.

**Causa:** a `DATABASE_CONNECTION_URI` está errada.

**Solução:** no painel Railway → Evolution → Variables → `DATABASE_CONNECTION_URI` deve ser exatamente:

```
${{Postgres.DATABASE_URL}}?schema=evolution
```

Se tiver outra coisa, edita pra esse valor exato. Salva. Redeploy.

---

### "QR Code não aparece"

**Sintoma:** abro `https://<agente>.up.railway.app/qr` e fica em "gerando QR Code…" pra sempre.

**Causas e soluções:**

1. **Agente não conseguiu falar com Evolution.**
   - Solução: verifica que `EVOLUTION_URL` no Agente é `http://${{Evolution.RAILWAY_PRIVATE_DOMAIN}}:8080` (sem `https`, com `:8080` no fim).

2. **Evolution não criou a instância ainda.**
   - Solução: olha logs do Agente — deve ter `Evolution instance created` ou `Evolution instance already exists`. Se não tem, espera 1 minuto, recarrega `/qr`.

3. **`EVOLUTION_API_KEY` não bate.**
   - Solução: confere que a API key no Agente é `${{Evolution.AUTHENTICATION_API_KEY}}` (referência cross-service, não copy/paste).

---

### "Conectou no WhatsApp mas mensagens não chegam OU agente responde mas cliente não recebe"

**Sintoma:** página `/qr` mostra "✅ Conectado". Cliente manda mensagem. Agente até processa (linha em `chat_messages` aparece) mas:
- ou a mensagem nunca chega (Evolution não dispara webhook)
- ou agente gera resposta mas `status = 'failed'` com erro `Connection Closed` ou `operation aborted`

**Causa raiz:** state interno do Baileys (lib que Evolution usa) ficou inconsistente após sync inicial pesado. `connectionState` mente dizendo `open` mas socket WebSocket interno tá quebrado. Comum com chip que tem histórico longo (>5k mensagens).

**Diagnóstico rápido — endpoint `/health/whatsapp`:**

Abre no navegador: `https://<AGENT_URL>/health/whatsapp`

Possíveis respostas:

| Status HTTP | `status` | Significado |
|---|---|---|
| 200 | `healthy` | Tudo certo |
| 503 | `unhealthy` | Desconectado, reescaneia QR |
| 503 | `degraded` | **state stale — precisa reset abaixo** |

Se voltar `degraded` (`5+ failures recent`), significa que o Evolution tá em loop "Connection Closed".

**Solução — reset hard da instance:**

1. Pega a `EVOLUTION_API_KEY` no service Evolution → Variables.
2. Pega a URL do Evolution (`evolution-production-XXXX.up.railway.app`).
3. Roda no terminal (ou peça ao Claude Code via Bash):
   ```bash
   curl -X DELETE "https://<EVOLUTION_URL>/instance/logout/agente" \
     -H "apikey: <KEY>"
   curl -X DELETE "https://<EVOLUTION_URL>/instance/delete/agente" \
     -H "apikey: <KEY>"
   ```
4. Railway → service Evolution → 3 pontinhos → **Restart**.
5. Quando voltar Active, faz **Restart** no service Agente também (bootstrap recria instance fresh).
6. **No celular**: abre WhatsApp → Aparelhos conectados → desconecta TODOS.
7. Abre `<AGENT_URL>/qr` e escaneia de novo.
8. Aguarda 3-5 min Baileys terminar sync inicial.

**Prevenção pra repetir menos:** o agente já tenta retry com backoff (5s → 15s → 30s) em erros transitórios — então flutuações curtas resolvem sozinhas. Reset hard só é necessário quando state ficou definitivamente podre.

---

### "Escaneei o QR mas WhatsApp diz 'esse aparelho está desatualizado'"

**Causa:** Evolution usando uma versão de protocolo Web do WhatsApp que ficou velha. WhatsApp atualiza o protocolo de tempos em tempos.

**Solução:** atualizar a imagem da Evolution pra versão mais recente. No Railway → Evolution → Settings → Source → Image: muda de `v2.3.7` pra última stable (ex: `v2.3.8`). Save → Deploy.

---

### "Mando mensagem no WhatsApp e não recebo resposta"

**Sintomas e diagnósticos:**

1. **Webhook não chega no agente.**
   - Olha logs do Agente: deve ter linhas `evolution webhook handler` quando chega mensagem.
   - Se não tem: webhook do Evolution não está registrado. Volta no Evolution Manager (`<evolution-url>/manager`), instância "agente" → Webhooks → confere a URL e os eventos `MESSAGES_UPSERT` e `MESSAGES_UPDATE`.

2. **Webhook chega mas agente não responde.**
   - Olha logs do Agente — deve ter `flush triggered` 15s depois da mensagem.
   - Se mostra `agent run failed`: olha o erro. Geralmente é `OpenAI` (key inválida ou sem créditos).

3. **Agente respondeu no log mas WhatsApp não recebeu.**
   - Logs mostram `evolution send failed` — provável que a instância caiu. Volta em `/qr` e re-escaneia.

---

## Durante o uso

### "Mudei o prompt mas o agente continua respondendo igual"

**Causa:** cache de 30s.

**Solução:** espera 30s e manda nova mensagem. Se passar disso, confere via Claude Code:
> "lê o system_prompt atual do agent_configs"

Se o conteúdo é o que você escreveu, é cache mesmo. Se é o antigo, o `UPDATE` não rodou — repete o pedido.

---

### "Adicionei skill mas o agente não usa"

**Causas:**

1. **Skill com `active = false`.**
   - Solução: peça ao Claude Code: *"ativa a skill X"*.

2. **Cache de 30s.**
   - Solução: aguarda.

3. **Skill mal escrita.** O agente lê descrição + conteúdo, mas se você escrever só "use isso", ele não sabe quando.
   - Solução: peça ao Claude Code: *"melhora a skill X pra ela ser usada quando o cliente perguntar Y"*.

---

### "Agente está respondendo coisa errada / inventando"

**Causas comuns:**

1. **Modelo está alucinando porque tem pouca informação.**
   - Solução: adicione skill com a info correta, ou edite system_prompt com regras explícitas tipo "se não souber, responda: 'vou consultar e te confirmo'".

2. **Histórico longo confundindo.**
   - Solução: peça ao Claude Code: *"diminui o history_limit pra 15"* (default é 30).

3. **Modelo fraco.**
   - Solução: peça ao Claude Code: *"troca o modelo pra gpt-4o"* (custa mais, mas é mais inteligente).

---

### "Cliente reclamou de demora"

**Causa:** o agente espera 15s (debounce) pra agrupar mensagens curtas — comportamento intencional pra parecer humano.

**Solução:** se quiser mais rápido, peça ao Claude Code: *"reduz debounce pra 8 segundos"*. Não recomendo abaixo de 5s — começa a parecer robô.

---

### "Custo da OpenAI subiu muito"

**Diagnóstico:** peça ao Claude Code:
> "soma os tokens_in e tokens_out de chat_messages dos últimos 7 dias por dia"

**Otimizações:**

1. **Reduza `history_limit`** (de 30 pra 15-20) — corta tokens de input pela metade.
2. **Use `gpt-4.1-mini`** (default) em vez de `gpt-4o` — 10x mais barato.
3. **Cuidado com skills muito longas** — toda skill ativa é enviada todo turno.
4. **Documentos pesados (PDF)** custam muito — desativar em `services/media.ts` se for caso.

---

### "Posso pausar a IA pra falar com o cliente eu mesmo?"

Sim. Peça ao Claude Code:
> "pausa a IA pro número +5511999999999"

Quando quiser retomar:
> "retoma a IA pro +5511999999999"

Enquanto pausada, o agente recebe e armazena mensagens (em `chat_messages`), mas não responde. Você pode mandar do chip normalmente — vai aparecer no histórico como `from_me`.

---

## Tools (skills com código)

### "Pedi pra criar uma tool, mas o agente não tá usando"

**Causas e soluções:**

1. **Build da Railway ainda não terminou.** Push acabou de ir, build leva 5 min. Espera e tenta de novo.

2. **Esqueceu de adicionar o `import` em `src/tools/index.ts`.** Confere via Bash: `grep "import './" src/tools/index.ts`. Se a tua tool não aparece, peça pro Claude Code: *"adiciona o import da tool X no index"*.

3. **Description da tool está vaga.** O LLM não sabe quando usar. Peça pro Claude Code: *"melhora a description da tool X pra ser mais específica sobre quando usar"*.

4. **Modelo não suporta tool calling.** `gpt-4.1-mini` (default) suporta. Se você trocou pra modelo mais antigo, pode ter perdido essa capacidade.

---

### "OpenAI rejeitou minha tool com erro `Schema is invalid`"

**Causa:** strict mode exige regras específicas no JSON Schema:
- `additionalProperties: false` em **TODO** objeto aninhado, não só na raiz
- `required: [...]` listando 100% das keys de `properties`
- Pra opcional, `type: ['string', 'null']` em vez de remover do `required`

**Solução:** peça pro Claude Code: *"valida o schema da tool X — strict mode tá quebrando"*. Ele revisa e corrige.

---

### "Tool com Playwright timeout"

**Sintoma:** log mostra `tool timeout after 300000ms` ou `page.waitForSelector: Timeout`.

**Causas comuns:**

1. **Site protegido por Cloudflare/captcha** (tela "Confirme que é humano" ou aba "Um momento…").
   - **1ª defesa — já vem no template:** o `_TEMPLATE-playwright.ts.example` importa de `playwright-extra` + `puppeteer-extra-plugin-stealth` e chama `chromium.use(StealthPlugin())`. O stealth disfarça os sinais de automação (`navigator.webdriver`, fingerprint, etc.) e passa pelo Cloudflare Turnstile na MAIORIA dos casos. Garanta que a tool importa de `playwright-extra` (não de `playwright` puro) e chama `chromium.use(StealthPlugin())`.
   - A splash "Um momento…" faz parte do Cloudflare — trate com `page.waitForFunction(...)` por um marcador de conteúdo real + reload de fallback (regra 4 do template), não com `waitForSelector` simples que resolve cedo demais.
   - **Só se o stealth não bastar** (captcha muito agressivo): aí sim considere API oficial do site, se existir, ou serviço externo pago de scraping (Browserless, Browserbase).

2. **Seletor CSS errado.** Site mudou layout. Peça pro Claude Code: *"ajusta o seletor da tool X — site Y tá retornando vazio"*.

3. **Tempo de carregamento real do site > 30s.** Aumenta `page.goto(..., { timeout: 60_000 })` na tool.

---

### "Cliente espera muito tempo quando tool roda"

**Causa:** tool com Playwright leva 10-30s real.

**Solução:** o agente já manda `sendPresence: composing` (status "está digitando…") durante a execução, então cliente sabe que tá trabalhando. Se ainda assim quer mais rápido:
- Cache resultado da tool em memória (last 5 min) se a info não muda muito.
- Use API direta em vez de scraping quando possível.
- Considere mover a tool pra serviço externo dedicado (Vercel/Cloudflare Workers).

---

## Reset completo

### "Quero apagar tudo e começar do zero"

⚠️ **Confirma 2 vezes.** Vai apagar histórico de conversas + skills + config.

Peça ao Claude Code:
> "apaga TUDO do banco e recria do zero"

Ele vai:
1. `DROP TABLE` em todas as tabelas do agente.
2. Reaplicar o schema (do `src/db/schema.sql`).
3. Re-bootstrap o agent_configs com placeholder.

Depois você refaz a entrevista.

### "Quero trocar o número do WhatsApp"

1. Vai em `<agente>/qr` no navegador.
2. No painel Evolution Manager, desconecta a instância atual.
3. Recarrega `/qr` — vai mostrar novo QR pro novo chip.

Histórico fica preservado (separado por `session_id` por número).
