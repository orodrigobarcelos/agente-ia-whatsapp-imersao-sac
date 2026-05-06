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
- Você NUNCA toca em "Settings", "Networking", "Generate Domain", "TCP Proxy"
  ou qualquer botão de configuração. O template já provisionou tudo.
- Você NUNCA clica em "Edit", "Disconnect", "Restart", "Redeploy".
- Sua única atividade pós-Deploy é: hover em uma linha de variável → ícone de
  COPY → colar no chat. NADA além.

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

6) Pega a URL do Postgres:

   a) Clica no card do serviço "Postgres" no canvas do projeto.
   b) Painel abre. Clica na aba "Variables".
      ATENÇÃO: NÃO clica em Settings. NÃO clica em Database. APENAS Variables.
   c) Lista de ~13 variáveis aparece, cada linha com valor mascarado ("*******").
   d) Encontra a linha "DATABASE_PUBLIC_URL" (geralmente a primeira da lista,
      com "PUBLIC" no nome). NÃO é a "DATABASE_URL" sem PUBLIC.
   e) Hover sobre a linha do DATABASE_PUBLIC_URL. Aparecem 2 ícones do lado
      direito dos asteriscos:
         - 👁 olho (revela visualmente)
         - 📋 duas páginas sobrepostas (COPY)
   f) Clica no ícone 📋 (COPY). O valor REAL é copiado pro clipboard.
      Esse é o ÚNICO caminho que copia o valor resolvido.
      NÃO usa Raw Editor (mostra referências, não funciona).
      NÃO usa 3 pontinhos > Edit (mesma coisa, não funciona).
   g) Cola o valor copiado AQUI NO CHAT pra eu ver. Formato esperado:
      postgresql://postgres:SENHA@trolley.proxy.rlwy.net:PORTA/railway

7) ⏸ FIM. Você terminou.

   Diga: "pronto, copia a URL acima e cola no Claude Code. Ele vai te dar o
   próximo prompt pra eu pegar a URL do Agente."

   Espera. NÃO faça mais nada. NÃO navegue. NÃO feche aba. NÃO toque em outros
   serviços. Apenas espera o aluno voltar com novo prompt.

REGRAS FINAIS
- Não invente URLs. Se não conseguir achar alguma, me avise e pare.
- Se o deploy travar com erro, copie a mensagem e me mostre.
- Se eu pedir pra parar a qualquer momento, pare imediatamente.
- NUNCA toque em Settings. NUNCA habilite nada. NUNCA configure nada.
```

---

## Notas pra você (Rodrigo)

1. URL do template já preenchida.
2. `__OPENAI_KEY__` é placeholder substituído pelo Claude Code em runtime.
3. Após esse prompt, o aluno volta no Claude Code com a `DATABASE_PUBLIC_URL`.
4. Claude Code escreve `.env.local` + `.mcp.json` e entrega o **PROMPT #2**
   (`PROMPT-AGENT-URL.md`) pra extrair a URL do Agente.
