# Magic Prompt — Deploy Railway via Claude for Chrome

> **Não cola esse arquivo direto.** Quem entrega o prompt final pro aluno é o **Claude Code app desktop**, que substitui `__OPENAI_KEY__` pela key real antes de exibir.
>
> Aluno usa apenas o resultado processado pelo Claude Code, copia, e cola no **Claude for Chrome**.

---

## Prompt (o que vai pro Chrome)

```
Você é meu assistente de deploy. Seu trabalho é colocar um agente de IA pra
WhatsApp no ar na Railway, sem que eu precise navegar nada manualmente.

CONTEXTO
- Já tenho conta Railway com cartão cadastrado.
- Já tenho o template Railway na URL: https://railway.com/deploy/FPInUA?referralCode=TOg9K1
- Minha OpenAI API key é: __OPENAI_KEY__
- Você vai criar um deploy desse template, esperar subir, e me devolver 2 URLs.

PASSO A PASSO

1) Abre uma aba em https://railway.com/deploy/FPInUA?referralCode=TOg9K1

2) Se eu não estiver logado: me peça pra logar (eu logo). Aguarde retornar logado.

3) Quando aparecer a tela "Configure" do template:
   - Encontra o card do serviço chamado "Agente" (ou "agente-ia-whatsapp-imersao-sac").
   - No campo OPENAI_API_KEY desse card: cole exatamente "__OPENAI_KEY__".
   - Em todos os outros campos/serviços (Postgres, Evolution): deixe os defaults.
   - **Clica em "Save Config" DENTRO do card do Agente** (botão roxo no canto
     direito do card). Sem isso, a key não é salva e o Deploy vai falhar.
   - Confirma que apareceu "Ready to be deployed" no card do Agente.

4) Clica no botão grande "Deploy" lá embaixo da tela e me confirma que clicou.

5) Espera os 3 serviços subirem (Postgres → Evolution → Agente).
   Pode levar 3-5 minutos. Pergunte de tempos em tempos se quero aguardar mais.
   Quando os 3 estiverem com status "Active" / "Online", siga.

   IMPORTANTE: nesse momento o Railway redireciona pra um NOVO projeto (com nome
   aleatório tipo "mindful-benevolence" ou "disciplined-education"). É NESSE
   projeto novo que você vai trabalhar nos próximos passos — NÃO confunda com
   outros projetos que eu já tenha na conta.

6) FASE 1 — pegar SOMENTE a URL do Postgres. NÃO vai fazer nada além disso
   nesse passo.

   - No projeto NOVO, clica no card do serviço "Postgres".
   - Vai abrir um painel. Clica na aba "Variables" (no topo).
   - Vai aparecer lista de ~13 variáveis com valores mascarados ("*******").
   - Encontra a linha "DATABASE_PUBLIC_URL" (a primeira da lista, com "PUBLIC"
     no nome — NÃO é a "DATABASE_URL" sem PUBLIC).
   - Passa o mouse sobre essa linha (hover). Aparecem 2 ícones do lado direito
     dos asteriscos: ícone de OLHO (👁) e ícone de DUAS PÁGINAS (📋 copy).
   - Clica no ícone de COPY (📋, duas páginas). Railway copia o VALOR RESOLVIDO
     completo pro clipboard mesmo o valor estando mascarado visualmente.
   - Cola o valor copiado AQUI NO CHAT pra mim VER. Vai começar com
     "postgresql://postgres:" e terminar com "/railway".

   ⏸ STOP. PARA AQUI. NÃO faz mais nada.

   Espera EU (usuário) responder com "ok, pode continuar" no chat.

   Por que parar: se você pegou a URL errada (DATABASE_URL em vez de
   DATABASE_PUBLIC_URL, ou alguma var diferente), eu vou ver e te corrigir
   ANTES de você navegar pra outro serviço. Não desperdiça cliques.

   Se eu disser "tá errado, é a outra" → volta na lista, pega a outra, manda de
   novo, espera confirmação.

   Se eu disser "ok, pode continuar" → segue pra FASE 2 (passo 7).

   FALLBACK se NÃO encontrar os ícones de olho/copy ao passar o mouse:
   - Clica nos 3 pontinhos (⋮) do canto direito da linha.
   - Menu → "Edit" → modal com o valor visível.
   - Copia o valor. Cancela o modal.
   - Manda no chat e espera confirmação igual acima.

7) FASE 2 — só execute APÓS eu ter confirmado a URL do passo 6.

   Primeiro, FECHA o painel do Postgres:
   - Clica no X grande do canto SUPERIOR DIREITO do painel do Postgres
     (o X que fecha o painel inteiro do serviço).
   - Confirma que voltou pra view geral do projeto onde os 3 cards (Postgres,
     Evolution, Agente) ficam visíveis lado a lado no canvas.

   Agora identifica os 3 cards na view geral:
     - Postgres (ícone de elefante azul)
     - Evolution (ícone do logo Evolution verde)
     - Agente (ícone do GitHub, nome "agente-ia-whatsapp-imersao-sac")

   Clica no TERCEIRO — o do GitHub. NÃO é o Postgres, NÃO é o Evolution.

   - O painel abre na aba "Deployments".
   - Logo abaixo do nome do serviço, no topo dessa aba, aparece a URL pública
     já gerada (formato https://agente-ia-whatsapp-imersao-sac-production-XXX.up.railway.app).
   - COPIA essa URL pública (clica nela ou no ícone de copy ao lado).
   - Cola AQUI NO CHAT pra mim ver.

   (Não precisa ir em Settings → Networking. A URL aparece direto em Deployments.)

   ⏸ STOP de novo. Espera eu responder "ok, pode continuar" antes do passo 8.

8) FASE 3 — só execute APÓS confirmação das duas URLs.

   Me devolve as 2 URLs num bloco copiável EXATAMENTE neste formato (sem nada
   além, pra eu colar de uma vez):

   DATABASE_URL=<valor de POSTGRES_URL>
   AGENT_URL=<valor de AGENT_URL>

9) Diga "pronto, agora volta no Claude Code e cola essas 2 URLs lá".

REGRAS
- Não invente URLs. Se não conseguir achar alguma, me avise.
- Se o deploy travar com erro, copie a mensagem de erro e me mostre.
- Não toque em outras configurações além das instruídas.
- Se eu pedir pra parar a qualquer momento, pare.
- Se cair em projeto errado (ex: um projeto antigo da minha conta), volta pro
  projeto que foi criado AGORA pelo template — geralmente é o mais recente na
  listagem do dashboard Railway.
```

---

## Notas pra você (Rodrigo)

1. **URL do template Railway** já preenchida: `https://railway.com/deploy/FPInUA?referralCode=TOg9K1`. Se publicar versão nova do template, atualize as 2 ocorrências aqui.

2. **`__OPENAI_KEY__`** é o placeholder que o Claude Code substitui em tempo real (instrução tá no `CLAUDE.md`).

3. **Versão fallback** (sem Claude for Chrome): se um aluno não conseguir usar o Chrome, ele faz os passos 1-7 manualmente seguindo `docs/RAILWAY_VIA_CHROME.md`.
