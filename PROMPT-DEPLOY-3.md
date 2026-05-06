# Magic Prompt #3 — Espera build terminar + extrai AGENT_URL

> Último prompt da fase deploy. Espera o build do Agente terminar (que
> começou no Prompt #2) e devolve a URL pública pro Claude Code.
>
> Prompt sem placeholders.

---

## Prompt (o que vai pro Chrome)

````
Continuação do trabalho anterior. Você ainda está logado na Railway, na
mesma aba/sessão. Acabou de adicionar o service Agente no Prompt #2 — ele
tá buildando. Sua única missão agora é AGUARDAR o build terminar e me
entregar a URL pública.

REGRAS
- VOCÊ NUNCA toca em Settings, Networking, Generate Domain, ou qualquer
  config. A URL JÁ EXISTE — só precisa LER e copiar.
- VOCÊ NÃO toca em outros services.

PASSO A PASSO

1) Garante que estás no projeto Railway. Se está com painel de outro
   service aberto, fecha (X grande do canto superior direito).

2) Clica no card do Agente.

3) Aba "Deployments" (topo do painel).

4) Verifica o status do deployment mais recente:
   - Se status é "Active" ou "Success" (verde) → vai pro passo 5.
   - Se status é "Building" / "Deploying" (azul/amarelo) → AGUARDA. Pode
     levar até 7 min total. Verifica de novo em ~1 min.
   - Se status é "Failed" / "Crashed" (vermelho) → COPIA a mensagem
     completa do log e me mostra. Pare.

5) Quando estiver "Active":
   a) No topo da aba Deployments, abaixo do nome do service, aparece a URL
      pública gerada. Formato esperado:
      https://agente-production-XXXX.up.railway.app

   b) Clica pra copiar (ou copia manualmente).

6) Cola a URL AQUI NO CHAT pra eu ver.

7) ⏸ FIM. Diga:

   "pronto, copia essa URL e cola no Claude Code. Ele finaliza o setup
   (entrevista + QR Code do WhatsApp)."

REGRAS FINAIS
- Se não achar a URL no painel Deployments, tenta em Settings → Networking
  → seção "Public Networking".
- Se o Agente nunca virar Active e ficar tipo 15 min em Building, copia o
  log completo e me mostra.
- Se eu pedir pra parar a qualquer momento, pare imediatamente.
````

---

## Notas pra você (Rodrigo)

1. **Sem placeholders.** Pode ser entregue bruto.
2. Esse prompt é "passivo" — só espera + lê. Pra Chrome não fazer ação destrutiva.
3. Após o aluno colar `AGENT_URL` no Claude Code, ele atualiza `.env.local`, pede restart do Claude Code, e segue pro Passo 7 do `CLAUDE.md` (entrevista, salva prompt no DB, QR Code).
