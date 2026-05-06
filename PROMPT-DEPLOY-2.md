# Magic Prompt #2 — Adiciona Evolution API

> Continuação do trabalho anterior, na MESMA aba/sessão do Chrome. Adiciona
> o service Evolution (gateway WhatsApp) e configura todas as env vars.
>
> Placeholder: `__EVOLUTION_API_KEY__` — Claude Code GERA uma string
> aleatória (>=32 chars) e substitui antes de entregar pro aluno. Mesma
> key vai entrar no Agente (Prompt #3).

---

## Prompt (o que vai pro Chrome)

````
Continuação. Já tem o projeto Railway criado com Postgres rodando e TCP
Proxy ativo. Agora você adiciona o service Evolution API. Esse é o
SEGUNDO de três prompts.

REGRAS
- VOCÊ não mexe no Postgres (já tá pronto).
- VOCÊ NUNCA clica em Edit/Disconnect/Restart/Eject de service algum.
- VOCÊ NÃO toca no service Agente (não foi criado ainda).

PASSO A PASSO

1) Garante que estás no projeto novo (criado no prompt anterior). Se está
   no painel do Postgres aberto, fecha (X grande no canto superior direito).

2) Na view do projeto, clica "+ New" → "Docker Image".

3) No campo de imagem, cola exatamente:
   evoapicloud/evolution-api:v2.3.7

   Confirma. Railway vai criar o service. Pode demorar pra aparecer
   "Deploying" — espera.

4) Renomeia o service pra "Evolution":
   a) Clica no card do service novo.
   b) 3 pontinhos no canto → "Rename" OU Settings → Service Name.
   c) Coloca "Evolution".

5) Configura env vars via Raw Editor:
   a) No painel do Evolution, aba "Variables" (topo).
   b) Clica botão "Raw Editor" (canto direito da tela).
   c) APAGA tudo que tiver lá (deve estar vazio ou só com PORT).
   d) COLA o bloco abaixo INTEIRO (sem mexer em nada — as referências
      ${{...}} são resolvidas pelo Railway automaticamente):

```text
SERVER_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
AUTHENTICATION_API_KEY=__EVOLUTION_API_KEY__
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
DEL_INSTANCE=false
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=${{Postgres.DATABASE_URL}}?schema=evolution
DATABASE_CONNECTION_CLIENT_NAME=evolution_exchange
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
DATABASE_SAVE_DATA_LABELS=true
DATABASE_SAVE_DATA_HISTORIC=true
QRCODE_LIMIT=30
QRCODE_COLOR=#175197
CACHE_REDIS_ENABLED=false
CACHE_LOCAL_ENABLED=true
LANGUAGE=pt-BR
TYPEBOT_ENABLED=false
OPENAI_ENABLED=false
WEBHOOK_GLOBAL_ENABLED=false
LOG_LEVEL=ERROR,WARN,INFO
LOG_COLOR=true
LOG_BAILEYS=error
```

   e) Clica "Update Variables" (botão no canto inferior do Raw Editor).
   f) Banner no topo "X changes" → clica "Deploy ⇧+Enter".
   g) Aguarda redeploy (~1-2 min). Status volta pra "Active".

6) Generate Domain HTTP no Evolution:
   a) Settings → Networking
   b) Procura "Public Networking" (NÃO é TCP Proxy — Evolution é HTTP).
   c) Clica botão "Generate Domain".
   d) Vai aparecer URL tipo "evolution-production-XXXX.up.railway.app".
   e) Aguarda ficar Active depois do generate (~30s).

7) ⏸ FIM. Diga:

   "pronto, Evolution rodando. Volta pro Claude Code pra ele te dar o
   terceiro e último prompt pra subir o Agente."

   Espera. NÃO toque em mais nada. NÃO crie outro service.

REGRAS FINAIS
- Se o Raw Editor der erro de sintaxe ao colar, me avise e pare.
- Se o redeploy do Evolution falhar, copie a mensagem completa do log.
- Se eu pedir pra parar a qualquer momento, pare imediatamente.
````

---

## Notas pra você (Rodrigo)

1. **`__EVOLUTION_API_KEY__`** — Claude Code GERA uma string aleatória (32+ chars hex) e substitui antes de entregar. Guarda ela na conversa pra reusar no Prompt #3.

2. **`${{Postgres.DATABASE_URL}}?schema=evolution`** — Railway resolve a referência no container do Evolution. O schema `evolution` é separado do `public` que o Agente usa. Coexistem no mesmo banco.

3. **`WEBHOOK_GLOBAL_ENABLED=false`** — webhook é configurado por instância (pelo bootstrap do Agente quando subir).

4. **`CACHE_REDIS_ENABLED=false` + `CACHE_LOCAL_ENABLED=true`** — Evolution funciona sem Redis (que custaria $1+/mês a mais).

5. Após esse prompt, aluno só diz "pronto" no Claude Code. Não precisa colar URL nenhuma — Evolution é referenciado por `${{Evolution.RAILWAY_PRIVATE_DOMAIN}}` interno no Prompt #3.
