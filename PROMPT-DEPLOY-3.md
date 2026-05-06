# Magic Prompt #3 — Adiciona Agente do GitHub do aluno + extrai AGENT_URL

> Último prompt da fase deploy. Adiciona o service Agente apontando pro
> repositório GitHub privado do aluno (criado no Passo 1 do CLAUDE.md),
> configura env vars e devolve a URL pública pro Claude Code.
>
> Placeholders:
> - `__GITHUB_REPO__` — Claude Code substitui por `<username>/<repo>`
> - `__EVOLUTION_API_KEY__` — mesma key do Prompt #2 (Claude Code mantém em memória)
> - `__OPENAI_KEY__` — key do aluno (do Passo 2 do CLAUDE.md)

---

## Prompt (o que vai pro Chrome)

````
Continuação. Já tem Postgres + Evolution rodando no projeto Railway. Agora
você adiciona o Agente, puxando do MEU repositório privado do GitHub. Esse
é o TERCEIRO e ÚLTIMO prompt.

REGRAS
- VOCÊ não mexe no Postgres nem no Evolution (estão prontos).
- VOCÊ NUNCA clica em Edit/Disconnect/Restart/Eject de service algum.

PASSO A PASSO

1) Garante que estás no projeto. Fecha qualquer painel de service aberto
   (X grande no canto superior direito).

2) Na view do projeto, clica "+ New" → "GitHub Repo".

3) Se for primeira vez Railway acessar GitHub:
   a) Vai abrir popup "Configure GitHub App" / "Authorize Railway".
   b) Aceita / autoriza. Se pedir escopo: "Only select repositories"
      e marca "__GITHUB_REPO__".
   c) Confirma. Volta pra Railway.

4) Na lista de repos que aparece, seleciona "__GITHUB_REPO__".

5) Branch: deixa "main" (default).

6) Confirma. Railway começa o build. Pode demorar 5-7 minutos — Dockerfile
   instala Chromium pro Playwright (~400MB extra). NÃO É FALHA, é o tempo
   normal. Continua os próximos passos enquanto builda.

7) Renomeia o service pra "Agente":
   a) 3 pontinhos no card → "Rename" OU Settings → Service Name.
   b) Coloca "Agente".

8) Configura env vars via Raw Editor (antes do build terminar tudo bem):
   a) Clica no card do Agente.
   b) Aba "Variables" (topo).
   c) Clica "Raw Editor".
   d) APAGA o que tiver (geralmente vazio ou só PORT).
   e) COLA o bloco INTEIRO abaixo (sem mexer — referências ${{...}} são
      resolvidas pelo Railway):

```text
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=${{Postgres.DATABASE_URL}}
EVOLUTION_URL=http://${{Evolution.RAILWAY_PRIVATE_DOMAIN}}:8080
EVOLUTION_API_KEY=__EVOLUTION_API_KEY__
EVOLUTION_INSTANCE=agente
PUBLIC_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
OPENAI_API_KEY=__OPENAI_KEY__
```

   f) Clica "Update Variables".
   g) Banner topo → "Deploy". Aguarda redeploy completo.

9) Generate Domain HTTP no Agente:
   a) Settings → Networking
   b) "Public Networking" → "Generate Domain"
   c) URL pública vai aparecer (formato:
      agente-production-XXXX.up.railway.app ou similar).
   d) Aguarda Agente virar "Active" depois do generate.

10) PEGA a URL pública do Agente:
    a) Aba "Deployments" do Agente.
    b) No topo, abaixo do nome do service, aparece a URL pública gerada.
       Formato esperado:
       https://agente-production-XXXX.up.railway.app
    c) Clica pra copiar (ou copia manualmente).

11) Cola a URL AQUI NO CHAT pra eu ver.

12) ⏸ FIM. Diga:

    "pronto, copia essa URL e cola no Claude Code. Ele finaliza o setup."

REGRAS FINAIS
- Se o build do Agente FALHAR, copie a mensagem completa do log e me mostra
  (NÃO tenta refazer sozinho).
- Se Railway pedir pra reautorizar GitHub no meio do processo, autoriza.
- Se eu pedir pra parar a qualquer momento, pare.
- Build de 5-7 min É NORMAL. Não considera falha enquanto estiver "Building"
  ou "Deploying" — só quando aparecer status vermelho "Failed" ou "Crashed".
````

---

## Notas pra você (Rodrigo)

1. **3 placeholders** que Claude Code substitui antes de entregar:
   - `__GITHUB_REPO__` → `<username>/<repo>` (ex: `joaodasilva/agente-ia-whatsapp`). Claude Code obtém via `gh api user --jq .login` + nome de repo escolhido no Passo 1.
   - `__EVOLUTION_API_KEY__` → mesma key gerada no Prompt #2. Claude Code guarda em memória entre prompts.
   - `__OPENAI_KEY__` → key do aluno (do Passo 2 do CLAUDE.md).

2. **Build longo (5-7 min)**: Chromium pesa. Documentado pra Chrome não interpretar como falha.

3. **`EVOLUTION_URL` interno (`RAILWAY_PRIVATE_DOMAIN:8080`)**: Agente fala com Evolution via rede privada do projeto Railway — sem custo de egress, mais rápido.

4. **Após esse prompt**, aluno cola `AGENT_URL` no Claude Code. Claude Code:
   - Atualiza `.env.local` com `AGENT_URL=...`
   - Pede restart do Claude Code (carregar MCP Postgres com a URL real)
   - Continua o fluxo (entrevista, salva prompt no DB, QR Code).
