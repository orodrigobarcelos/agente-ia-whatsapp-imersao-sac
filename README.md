# Agente IA pra WhatsApp — Template Simplificado

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/lwxg0j?referralCode=TOg9K1)

Template plug-and-play. **Você sai dessa página com um agente de IA respondendo no WhatsApp em ~1h30**, sem terminal, sem editar código.

> **Sobre o botão acima:** ele deploya APENAS a infra (Postgres + Evolution). O service do Agente é criado depois pelo Claude Code apontando pro **teu repo privado no GitHub**. Não use o botão sem seguir o fluxo do `CLAUDE.md` — você precisa do Claude Code pra fazer o setup completo.

---

## O que esse template entrega

- Um número de WhatsApp (chip seu, não oficial) que **lê texto, áudio, imagem e documentos** e responde com personalidade que você definir.
- Hospedagem na **Railway** (3 serviços: Postgres + Evolution API + Agente puxando do **TEU** GitHub).
- Customização ao vivo via **Claude Code app desktop**:
  - **Skills texto** (Postgres, ativa em ~30s) — conhecimento, persona, FAQ, roteiros condicionais.
  - **Skills com código (tools)** — agente CONSULTA APIs, faz scraping com Playwright, calcula, integra com sistemas. Você diz "skill", o Claude Code cria, testa, comita e dá push pro teu GitHub. Railway redeploya em ~5 min.
- Repositório **privado teu** — não dependência de template fixo. Editável pra sempre.

---

## Antes de começar — checklist

Leia [CHECKLIST-ANTES.md](./CHECKLIST-ANTES.md). Você precisa:

1. **Anthropic Pro** + **Claude Code app desktop** instalado.
2. **Claude for Chrome** instalado e logado.
3. **Conta GitHub** (privada — código vai pra lá).
4. **Conta Railway** com cartão cadastrado.
5. **Conta OpenAI** com US$ 5 e key copiada.
6. **Chip de WhatsApp dedicado** (não use seu número pessoal).

Sem essas 6, você vai travar. **Faça antes da imersão**.

---

## Como instalar (≈15 cliques, ≈1h30)

### 1. Baixe esse template como ZIP

Clique no botão verde **"Code"** no topo da página e depois **"Download ZIP"**. Extraia onde quiser (ex: `~/Documentos/meu-agente`).

### 2. Abra a pasta extraída no Claude Code

`File → Open Folder` → escolha a pasta. Aceite "Trust this folder".

### 3. Diga ao Claude Code:

> *"vamos instalar esse agente"*

Ele vai ler o [`CLAUDE.md`](./CLAUDE.md) e te conduzir do começo ao fim:

1. **Setup GitHub** — verifica/instala `gh` CLI, faz OAuth, cria teu repo privado e dá push inicial do código.
2. **OpenAI key** — você cola no chat.
3. **Magic Prompt #1** — Chrome deploya o template Railway (Postgres + Evolution) + habilita TCP Proxy + extrai DATABASE_PUBLIC_URL.
4. **Magic Prompt #2** — Chrome adiciona o service Agente puxando do TEU repo GitHub privado (build leva 5-7 min — instala Chromium pro Playwright).
5. **Magic Prompt #3** — Chrome aguarda o build terminar e extrai a URL pública do Agente.
6. **Restart Claude Code** pra carregar MCP Postgres.
7. **Entrevista** — 10 perguntas pra montar a personalidade do agente.
8. **QR Code** — escaneia com seu chip.

**Pronto.** Manda mensagem no WhatsApp e o agente responde.

---

## Como editar o agente depois

Tudo dentro do Claude Code, em português:

```
"deixa o agente mais informal"                              ← skill texto
"adiciona uma skill pra agendamento, horário comercial"     ← skill texto
"quero que ele consulte o preço do produto X no site Y"     ← skill com código (tool)
"quero que ele calcule o frete via API dos Correios"        ← skill com código (tool)
"o cliente +5511999... reclamou — me mostra o que conversaram"
```

- Skills **texto** ativam em ~30s (cache).
- Skills com **código (tools)** ativam em ~5 min (push pro teu GitHub → Railway redeploya).

Veja [`CLAUDE.md`](./CLAUDE.md) pra workflow detalhado, e [`docs/EXEMPLOS-DE-TOOLS.md`](./docs/EXEMPLOS-DE-TOOLS.md) pra galeria de ideias.

---

## Arquitetura (resumo técnico)

| Camada | Stack |
|---|---|
| Hospedagem | Railway (Postgres + Evolution API + Agente Node) |
| Source | TEU repositório privado no GitHub (Railway puxa, redeploya em push) |
| WhatsApp | Evolution API v2.3.7 (não oficial, usa chip) |
| LLM | OpenAI gpt-4.1-mini (chat + tool calling), whisper-1 (áudio), gpt-4o-mini (imagem) |
| Tools | Function calling nativo OpenAI + Playwright (Chromium pré-instalado no Dockerfile) |
| DB | Postgres (compartilhado entre Evolution e Agente, schemas separados) |
| Linguagem | TypeScript + Fastify |
| Customização | Claude Code app desktop + MCP Postgres + git/gh CLI |

Detalhes em [`docs/ARQUITETURA.md`](./docs/ARQUITETURA.md) e [`docs/COMO-FUNCIONA-TOOLS.md`](./docs/COMO-FUNCIONA-TOOLS.md).

---

## Suporte

Travou? Veja [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md).

Quer mergulhar a fundo? Veja o **Programa de Implementação** (6 meses, refatora cada peça).
