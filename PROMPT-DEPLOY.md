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
   - No campo OPENAI_API_KEY: cole exatamente "__OPENAI_KEY__".
   - Em todos os outros campos: deixe os defaults.

4) Clica em "Deploy" e me confirma que clicou.

5) Espera os 3 serviços subirem (Postgres → Evolution → Agente).
   Pode levar 3-5 minutos. Pergunte de tempos em tempos se quero aguardar mais.
   Quando os 3 estiverem com status "Active" / "Running", siga.

6) Vai no serviço "Postgres" → aba "Variables":
   - Encontra DATABASE_PUBLIC_URL
   - Clica no ícone de "olho" pra revelar a senha
   - COPIA o valor completo (começa com postgresql://postgres:...)
   - Guarda como POSTGRES_URL

7) Vai no serviço "Agente" → aba "Settings" → seção "Networking":
   - Se não tiver domínio público gerado, clica "Generate Domain"
   - COPIA a URL gerada (algo tipo https://agente-production-xxxx.up.railway.app)
   - Guarda como AGENT_URL

8) Me devolve essas 2 URLs num bloco copiável EXATAMENTE neste formato (sem nada
   além disso, pra eu colar de uma vez):

   DATABASE_URL=<valor de POSTGRES_URL>
   AGENT_URL=<valor de AGENT_URL>

9) Diga "pronto, agora volta no Claude Code e cola essas 2 URLs lá".

REGRAS
- Não invente URLs. Se não conseguir achar alguma, me avise.
- Se o deploy travar com erro, copie a mensagem de erro e me mostre.
- Não toque em outras configurações além das instruídas.
- Se eu pedir pra parar a qualquer momento, pare.
```

---

## Notas pra você (Rodrigo)

1. **URL do template Railway** já preenchida: `https://railway.com/deploy/FPInUA?referralCode=TOg9K1`. Se publicar versão nova do template, atualize as 2 ocorrências aqui.

2. **`__OPENAI_KEY__`** é o placeholder que o Claude Code substitui em tempo real (instrução tá no `CLAUDE.md`).

3. **Versão fallback** (sem Claude for Chrome): se um aluno não conseguir usar o Chrome, ele faz os passos 1-7 manualmente seguindo `docs/RAILWAY_VIA_CHROME.md`.
