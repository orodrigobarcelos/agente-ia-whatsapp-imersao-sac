# Deploy via Claude for Chrome — fallback manual

Esse arquivo documenta o **passo a passo manual** de deploy na Railway pra quem não conseguiu usar o Claude for Chrome (ou quer entender o que ele faz por baixo).

---

## Quando usar esse documento

- Você não tem Claude for Chrome instalado.
- Claude for Chrome travou em algum passo.
- Você quer entender exatamente o que está acontecendo na Railway.
- Você quer recriar o agente em outra conta Railway.

Se você está usando o fluxo normal (Claude Code → Claude for Chrome dirige), **pula esse documento** — não precisa.

---

## Passo a passo

### 1. Abra o link do template

Vai pra:

```
https://railway.com/template/SUBSTITUIR_PELO_TEMPLATE_ID_DO_RODRIGO
```

(Rodrigo divulga essa URL pra você.)

### 2. Faça login na Railway

Se não tiver conta: crie em [railway.com](https://railway.com), adicione cartão (verificação obrigatória).

### 3. Configure o template

Tela "Configure Project":

| Campo | O que colocar |
|---|---|
| `OPENAI_API_KEY` | sua key copiada do platform.openai.com (começa com `sk-proj-...`) |
| `AGENT_PROMPT_BOOTSTRAP` | **deixa vazio** — vai ser configurado depois pelo Claude Code |
| Outros campos | deixa o default |

### 4. Clica em "Deploy"

Railway vai começar a subir 3 serviços em paralelo:
- **Postgres** — geralmente sobe em ~30s
- **Evolution** — sobe em ~1-2 min
- **Agente** — depende do build (~2-3 min na primeira vez)

Status vai de `Building` → `Deploying` → `Active`.

### 5. Espera os 3 ficarem `Active`

Tempo total: 3-5 minutos.

Se algum quebrar (`Crashed`):
- Clica no serviço problemático
- Aba **Deployments** → clica no deployment com erro
- Veja os logs
- Se for erro de variável faltando: configura e re-deploya
- Se for erro de build: copia o erro e mostra pro Claude Code resolver

### 6. Pega a `DATABASE_PUBLIC_URL`

1. Clica no serviço **Postgres**.
2. Aba **Variables**.
3. Acha `DATABASE_PUBLIC_URL`.
4. Clica no ícone de "olho" pra revelar o valor completo.
5. Clica no ícone de copiar.

Formato: `postgresql://postgres:SENHA@viaduct.proxy.rlwy.net:PORTA/railway`

### 7. Pega a URL pública do Agente

1. Clica no serviço **Agente**.
2. Aba **Settings** → seção **Networking**.
3. Se NÃO tem domínio: clica em **Generate Domain**.
4. Copia a URL gerada (ex: `https://agente-production-abc123.up.railway.app`).

### 8. Volta pro Claude Code

Cola as 2 URLs no chat do Claude Code:

```
DATABASE_URL=postgresql://postgres:SENHA@viaduct.proxy.rlwy.net:PORTA/railway
AGENT_URL=https://agente-production-abc123.up.railway.app
```

O Claude Code vai escrever `.env.local` e `.mcp.json`, e te pedir pra reiniciar.

### 9. Continua no fluxo normal

A partir daqui, segue o `CLAUDE.md` — reiniciar Claude Code, fazer as 10 perguntas, escanear QR.

---

## Comandos úteis pra debugar pelo painel Railway

### Ver logs ao vivo de um serviço

1. Clica no serviço (Postgres / Evolution / Agente).
2. Aba **Deployments** → clica no deployment ativo.
3. Aba **Logs** → escolhe **HTTP Logs** ou **Build Logs**.

### Ver variáveis de ambiente (sem editar)

Aba **Variables** do serviço.

### Restart de um serviço

Aba **Deployments** → 3 pontinhos no deployment → **Restart**.

### Re-deploy após mudar variável

Quando você muda uma variável, Railway tenta restart automático. Se não rolar:

Aba **Deployments** → 3 pontinhos → **Redeploy**.

### Ver custo

Painel principal do projeto → topo direito mostra "$X.XX this month".

Se passar de $5/mês com pouco uso, abre as métricas (Memory / CPU / Egress) e vê qual serviço está esquentando.

---

## Quando entrar em contato com o Rodrigo

Se você travou em **algum passo do 1 ao 8** e:
- Já releu esse arquivo.
- Já tentou pedir ajuda pro Claude Code (mostrando o erro).
- Confirmou que tem cartão na Railway, $5 na OpenAI, e chip de WhatsApp.

Aí sim manda mensagem pro Rodrigo com:
1. Print do erro (ou texto do erro).
2. Em qual passo travou.
3. O que tentou fazer pra resolver.
