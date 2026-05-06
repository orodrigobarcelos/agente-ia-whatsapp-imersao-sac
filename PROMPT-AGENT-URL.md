# Magic Prompt #2 — Extrair URL pública do Agente

> Esse é o **segundo prompt** pra Claude for Chrome (mesma sessão do Prompt #1).
> Só extrai a URL pública do serviço Agente. Curto, foco único.
>
> O Claude Code entrega esse prompt pro aluno **depois** que ele cola a
> `DATABASE_PUBLIC_URL` (do Prompt #1).

---

## Prompt (o que vai pro Chrome)

```
Continuação do trabalho anterior. Você ainda está logado na Railway, na mesma
aba/sessão. Agora preciso só de UMA coisa: a URL pública do serviço Agente.

REGRAS
- Você NUNCA toca em Settings, Networking, Generate Domain, ou qualquer config.
- A URL JÁ EXISTE — só precisa LER e copiar.

PASSO A PASSO

1) Garante que você está NO PROJETO NOVO criado anteriormente (nome aleatório
   tipo "respectful-bravery"). Se você está no painel do Postgres aberto, fecha
   ele clicando no X grande do canto superior direito.

2) Na view geral do projeto, identifica os 3 cards visíveis:
     - Postgres (ícone de elefante azul)
     - Evolution (ícone do logo Evolution verde)
     - Agente (ícone do GitHub, nome "agente-ia-whatsapp-imersao-sac")

3) Clica no card do Agente (o do GitHub). NÃO é Postgres. NÃO é Evolution.

4) O painel abre na aba "Deployments" automaticamente.

5) Logo abaixo do nome do serviço, no topo dessa aba, aparece a URL pública
   já gerada. Formato:
       https://agente-ia-whatsapp-imersao-sac-production-XXX.up.railway.app

6) COPIA essa URL pública (clica nela, ou no ícone de copy ao lado).

7) Cola AQUI NO CHAT pra eu ver. Diga:

   "pronto, copia essa URL e cola no Claude Code. Ele finaliza o setup."

   NÃO vai em Settings. NÃO clica em Generate Domain. A URL JÁ ESTÁ visível
   em Deployments. Só copia e entrega.

REGRAS FINAIS
- Se não achar a URL, me avise e pare. NÃO tenta gerar/configurar nada.
- Se eu pedir pra parar, pare imediatamente.
```

---

## Notas pra você (Rodrigo)

1. Esse prompt assume que o aluno está na **mesma sessão** do Chrome onde
   rodou o Prompt #1. Não precisa logar de novo.
2. Curto e único — só copia URL e entrega.
3. Depois do aluno colar a URL no Claude Code, ele escreve no `.env.local`,
   pede pro aluno reiniciar o Claude Code, e segue pra entrevista das 10
   perguntas.
