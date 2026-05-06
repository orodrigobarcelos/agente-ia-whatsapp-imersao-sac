# Magic Prompt #1 — Deploy template (Postgres + Evolution) + TCP Proxy + DATABASE_PUBLIC_URL

> Primeiro de **três** prompts pra Claude for Chrome. Esse aqui só deploya o
> template Railway (2 services: Postgres + Evolution) e me dá a URL pública
> do banco. Os próximos dois adicionam o Agente do GitHub do aluno e extraem
> a URL pública do Agente.
>
> Prompt sem placeholders — pode ser entregue bruto pelo Claude Code.

---

## Prompt (o que vai pro Chrome)

````
Você é meu assistente de deploy. Vai deployar o template Railway que tem
Postgres + Evolution, habilitar TCP Proxy no Postgres e me dar a URL pública
do banco.

Esse é o PRIMEIRO de três prompts.

CONTEXTO
- Já tenho conta Railway com cartão.
- Template URL: https://railway.com/deploy/lwxg0j?referralCode=TOg9K1
- O template cria 2 services: Postgres + Evolution. NÃO cria o Agente — esse
  é adicionado nos prompts seguintes.

REGRAS GLOBAIS
- A ÚNICA configuração que você TEM permissão de mexer é "TCP Proxy" do
  Postgres (passo 5 abaixo).
- Você NUNCA toca em Settings do Evolution.
- Você NUNCA clica em Edit, Disconnect, Restart, Redeploy, Eject.
- Você NUNCA clica em "Generate Domain" no Postgres — Postgres não usa HTTP.

PASSO A PASSO

1) Abre uma aba em https://railway.com/deploy/lwxg0j?referralCode=TOg9K1

2) Se eu não estiver logado: peça pra eu logar. Aguarde retornar logado.

3) Tela "Configure" do template:
   - Mostra os 2 services (Postgres e Evolution).
   - Os defaults estão bons — NÃO mexe em campo nenhum.
   - Clica "Deploy" (botão grande embaixo).

4) Aguarda os 2 services subirem (~2-3 min). Postgres e Evolution viram
   "Active" / "Online". Railway redireciona pra um projeto novo (nome
   aleatório tipo "respectful-bravery").

5) Habilita TCP Proxy no Postgres (OBRIGATÓRIO antes de pegar URL):

   Quando o template provisiona Postgres, NÃO vem com TCP Proxy automático.
   Sem ele, a DATABASE_PUBLIC_URL fica com host/porta vazios:
   "postgresql://postgres:SENHA@:/railway" (note o "@:/" — quebrado).

   Pra resolver:
   a) Clica no card do Postgres no canvas do projeto.
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
   h) Clica no botão "Deploy" desse banner do topo (NÃO o botão Deploy
      original do template — é o NOVO botão que apareceu por causa da
      change pendente).
   i) Aguarda Railway aplicar a mudança (~30-60 segundos). O banner some
      quando termina.
   j) O Postgres vai voltar pra status "Active" / "Online".

6) Pega a URL pública do Postgres:

   a) Ainda no painel do Postgres, clica na aba "Variables" (no topo).
   b) Lista de variáveis aparece, cada linha com valor mascarado ("*******").
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

   ATENÇÃO: se o valor for "postgresql://postgres:SENHA@:/railway" (com
   "@:/" — host e porta vazios), o TCP Proxy do passo 5 ainda não terminou
   de provisionar. Aguarda mais 30 segundos e copia de novo.

7) ⏸ FIM. Diga:

   "pronto, copia a URL acima e cola no Claude Code. Ele vai te dar o
   próximo prompt pra eu adicionar o service do Agente puxando do GitHub."

   Espera. NÃO faça mais nada. NÃO navegue. NÃO feche aba. NÃO toque em
   outros services. Apenas espera o aluno voltar com novo prompt.

REGRAS FINAIS
- Não invente URLs. Se não conseguir achar alguma, me avise e pare.
- Se o deploy travar com erro, copie a mensagem e me mostre.
- Se eu pedir pra parar a qualquer momento, pare imediatamente.
````

---

## Notas pra você (Rodrigo)

1. **URL do template fixa**: `https://railway.com/deploy/lwxg0j?referralCode=TOg9K1`. Se mudar (republicar template), atualizar aqui.
2. **Sem placeholder.** Esse prompt é estável e pode ser entregue bruto pelo Claude Code.
3. Após esse prompt, o aluno volta no Claude Code com a `DATABASE_PUBLIC_URL`.
4. Claude Code escreve `.env.local` parcial + `.mcp.json`, e entrega o **PROMPT #2** pra adicionar o service Agente puxando do GitHub do aluno.
