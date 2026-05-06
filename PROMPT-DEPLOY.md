# Magic Prompt #1 — Deploy + DATABASE_PUBLIC_URL

> Esse é o **primeiro de dois** prompts pra Claude for Chrome. Esse aqui só
> deploya e extrai a URL do Postgres. O **segundo prompt** (PROMPT-AGENT-URL.md)
> só extrai a URL do Agente.
>
> O Claude Code app desktop substitui `__OPENAI_KEY__` pela key real antes de
> entregar pro aluno.

---

## Prompt (o que vai pro Chrome)

```
Você é meu assistente de deploy. Vai colocar um agente de IA pra WhatsApp no
ar na Railway. Esse é o PRIMEIRO de dois prompts. Aqui você só deploya e me
entrega a URL do Postgres. Outro prompt, depois, vai extrair a URL do Agente.

CONTEXTO
- Já tenho conta Railway com cartão cadastrado.
- Template Railway: https://railway.com/deploy/FPInUA?referralCode=TOg9K1
- Minha OpenAI API key é: __OPENAI_KEY__

REGRAS GLOBAIS
- A ÚNICA configuração que você TEM permissão de mexer é "TCP Proxy" do
  Postgres (passo 6 abaixo) — sem isso a URL pública do banco fica vazia.
- VOCÊ NÃO toca em Settings de Evolution NEM de Agente. Só do Postgres,
  exclusivamente pra TCP Proxy.
- Você NUNCA clica em "Edit", "Disconnect", "Restart", "Redeploy", "Eject".
- Você NUNCA clica em "Generate Domain" (HTTP) — isso é pra serviços HTTP, não
  pra Postgres. Postgres precisa de TCP Proxy, não de HTTP domain.

PASSO A PASSO

1) Abre uma aba em https://railway.com/deploy/FPInUA?referralCode=TOg9K1

2) Se eu não estiver logado: me peça pra logar. Aguarde retornar logado.

3) Tela "Configure" do template:
   - Encontra o card do serviço "Agente" (ou "agente-ia-whatsapp-imersao-sac").
   - No campo OPENAI_API_KEY desse card: cole "__OPENAI_KEY__".
   - Em todos os outros campos/serviços (Postgres, Evolution): deixe os defaults.
   - Clica "Save Config" DENTRO do card do Agente (botão roxo no canto direito).
   - Confirma que apareceu "Ready to be deployed" no card do Agente.

4) Clica no botão grande "Deploy" lá embaixo. Me confirma que clicou.

5) Espera os 3 serviços subirem (Postgres → Evolution → Agente).
   Pode levar 3-5 minutos. Quando os 3 estiverem "Active" / "Online", siga.

   Railway vai redirecionar pra um NOVO projeto (nome aleatório tipo
   "respectful-bravery"). É NESSE projeto novo que você trabalha. NÃO confunda
   com outros projetos antigos da minha conta.

6) Habilita TCP Proxy no Postgres (OBRIGATÓRIO antes de pegar URL):

   Quando o Postgres é provisionado pelo template, NÃO vem com TCP Proxy
   automático. Sem ele, a DATABASE_PUBLIC_URL fica com host/porta vazios:
   "postgresql://postgres:SENHA@:/railway" (note o "@:/" — quebrado).

   Pra resolver:
   a) Clica no card do serviço "Postgres" no canvas do projeto.
   b) Painel abre. Clica na aba "Settings" (última do topo).
   c) Rola a tela até achar a seção "Networking".
   d) Dentro de "Networking", procura subseção "TCP Proxy" (NÃO é "Public
      Networking" / "Generate Domain" — esses são pra HTTP). Procura um
      botão tipo "Add TCP Proxy" / "Generate TCP Proxy" / "Enable TCP Proxy".
   e) Clica nesse botão. Railway vai pedir uma porta interna — escolhe 5432
      (porta padrão Postgres) e confirma.
   f) Vai aparecer um endereço tipo "trolley.proxy.rlwy.net:XXXXX" listado.

   IMPORTANTE: criar o TCP Proxy gera uma "Change" pendente. Tem que aplicar:
   g) Olha pro topo da tela do projeto. Vai ter uma faixa/banner com texto
      tipo "1 change" e dois botões: "Details" e "Deploy ⇧+Enter" (em roxo).
   h) Clica no botão "Deploy" desse banner do topo (NÃO confunde com o
      botão Deploy original do template — é o NOVO botão que apareceu por
      causa da change pendente).
   i) Aguarda Railway aplicar a mudança (~30-60 segundos). O banner some
      quando termina.
   j) O Postgres vai voltar pra status "Active" / "Online".

7) Pega a URL do Postgres:

   a) Ainda no painel do Postgres, clica na aba "Variables" (no topo).
   b) Lista de ~13 variáveis aparece, cada linha com valor mascarado ("*******").
   c) Encontra a linha "DATABASE_PUBLIC_URL" (com "PUBLIC" no nome).
      NÃO é a "DATABASE_URL" sem PUBLIC.
   d) Hover sobre a linha do DATABASE_PUBLIC_URL. Aparecem 2 ícones do lado
      direito dos asteriscos:
         - 👁 olho (revela visualmente)
         - 📋 duas páginas sobrepostas (COPY)
   e) Clica no ícone 📋 (COPY). O valor REAL é copiado pro clipboard.
      Esse é o ÚNICO caminho que copia o valor resolvido.
      NÃO usa Raw Editor (mostra referências, não funciona).
      NÃO usa 3 pontinhos > Edit (mesma coisa, não funciona).
   f) Cola o valor copiado AQUI NO CHAT pra eu ver. Formato esperado:
      postgresql://postgres:SENHA@trolley.proxy.rlwy.net:PORTA/railway

   ATENÇÃO: se o valor copiado for "postgresql://postgres:SENHA@:/railway"
   (com "@:/" — host e porta vazios), significa que o TCP Proxy do passo 6
   ainda não terminou de provisionar. Aguarda mais 30 segundos e copia de
   novo. Se persistir, volta no passo 6 e verifica se o TCP Proxy realmente
   foi criado.

8) ⏸ FIM. Você terminou.

   Diga: "pronto, copia a URL acima e cola no Claude Code. Ele vai te dar o
   próximo prompt pra eu pegar a URL do Agente."

   Espera. NÃO faça mais nada. NÃO navegue. NÃO feche aba. NÃO toque em outros
   serviços. Apenas espera o aluno voltar com novo prompt.

REGRAS FINAIS
- Não invente URLs. Se não conseguir achar alguma, me avise e pare.
- Se o deploy travar com erro, copie a mensagem e me mostre.
- Se eu pedir pra parar a qualquer momento, pare imediatamente.
- A ÚNICA configuração permitida é habilitar TCP Proxy no Postgres (passo 6).
  Tudo o mais — Settings de Evolution, Settings do Agente, Generate Domain HTTP,
  Edit de variável, Disconnect, Restart — É PROIBIDO.
```

---

## Notas pra você (Rodrigo)

1. URL do template já preenchida.
2. `__OPENAI_KEY__` é placeholder substituído pelo Claude Code em runtime.
3. Após esse prompt, o aluno volta no Claude Code com a `DATABASE_PUBLIC_URL`.
4. Claude Code escreve `.env.local` + `.mcp.json` e entrega o **PROMPT #2**
   (`PROMPT-AGENT-URL.md`) pra extrair a URL do Agente.
