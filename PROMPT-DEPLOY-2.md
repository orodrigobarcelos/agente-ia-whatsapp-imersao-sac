# Magic Prompt #2 — Adiciona service Agente (do GitHub do aluno)

> Continuação do trabalho anterior, na MESMA aba/sessão do Chrome. Adiciona
> o terceiro service "Agente" puxando do repo GitHub privado do aluno e
> configura todas as env vars.
>
> Placeholders:
> - `__GITHUB_REPO__` — Claude Code substitui por `<username>/<repo>`
> - `__OPENAI_KEY__` — key do aluno (do Passo 2 do CLAUDE.md)
>
> A `EVOLUTION_API_KEY` NÃO é placeholder — vem por referência interna
> `${{Evolution.AUTHENTICATION_API_KEY}}` (gerada pelo template). Railway
> resolve sozinho.

---

## Prompt (o que vai pro Chrome)

````
Continuação. Já tem o projeto Railway criado com Postgres + Evolution
rodando e TCP Proxy ativo. Agora adiciona o terceiro service "Agente"
puxando do MEU repositório privado do GitHub. Esse é o SEGUNDO de três
prompts.

REGRAS
- VOCÊ não mexe no Postgres nem no Evolution (estão prontos).
- VOCÊ NUNCA clica em Edit/Disconnect/Restart/Eject de service algum.

PASSO A PASSO

1) Garante que estás no projeto criado anteriormente (com Postgres +
   Evolution rodando). Fecha qualquer painel de service aberto (X grande
   no canto superior direito).

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
EVOLUTION_API_KEY=${{Evolution.AUTHENTICATION_API_KEY}}
EVOLUTION_INSTANCE=agente
PUBLIC_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
OPENAI_API_KEY=__OPENAI_KEY__
```

   f) Clica "Update Variables".
   g) Banner topo → "Deploy". Aguarda redeploy começar.

9) Generate Domain HTTP no Agente:
   a) Settings → Networking
   b) "Public Networking" → "Generate Domain"
   c) URL pública vai aparecer (formato:
      agente-production-XXXX.up.railway.app ou similar).
   d) URL fica visível IMEDIATAMENTE, mas o service ainda tá buildando.

10) ⏸ FIM. Diga:

    "pronto, service do Agente criado e tá buildando (5-7 min).
    Volta pro Claude Code pra ele te dar o terceiro e último prompt
    pra extrair a URL pública do Agente quando o build terminar."

    Espera. NÃO toque em mais nada.

REGRAS FINAIS
- Se o build do Agente FALHAR já agora (algum erro de sintaxe na config),
  copie a mensagem completa do log.
- Se Railway pedir pra reautorizar GitHub no meio, autoriza.
- Se eu pedir pra parar a qualquer momento, pare.
- Build de 5-7 min É NORMAL. Não considera falha enquanto estiver "Building"
  ou "Deploying" — só quando aparecer status vermelho "Failed" ou "Crashed".
````

---

## Notas pra você (Rodrigo)

1. **2 placeholders apenas:**
   - `__GITHUB_REPO__` → `<username>/<repo>` (ex: `joaodasilva/agente-ia-whatsapp`). Claude Code obtém via `gh api user --jq .login` + nome de repo escolhido no Passo 1.
   - `__OPENAI_KEY__` → key do aluno (do Passo 2 do CLAUDE.md).

2. **`EVOLUTION_API_KEY` SEM placeholder!** Vem por referência interna `${{Evolution.AUTHENTICATION_API_KEY}}` — Railway resolve no container do Agente. Mesma key gerada pelo template no service Evolution.

3. **Build longo (5-7 min)**: Chromium pesa. Documentado pra Chrome não interpretar como falha.

4. **`EVOLUTION_URL` interno (`RAILWAY_PRIVATE_DOMAIN:8080`)**: Agente fala com Evolution via rede privada do projeto Railway — sem custo de egress, mais rápido.
