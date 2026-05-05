# Agente IA pra WhatsApp — Template Simplificado

Template plug-and-play. **Você sai dessa página com um agente de IA respondendo no WhatsApp em ~1 hora**, sem terminal, sem clonar repositório, sem editar código.

---

## O que esse template entrega

- Um número de WhatsApp (chip seu, não oficial) que **lê texto, áudio, imagem e documentos** e responde com personalidade que você definir.
- Hospedagem na **Railway** (3 serviços: Postgres + Evolution API + Agente).
- Customização ao vivo via **Claude Code app desktop** (sem mexer em código).
- **Skills modulares**: você adiciona "habilidades" em markdown que o agente passa a usar instantaneamente.

---

## Antes de começar — checklist

Leia [CHECKLIST-ANTES.md](./CHECKLIST-ANTES.md). Você precisa:

1. **Anthropic Pro** + **Claude Code app desktop** instalado.
2. **Claude for Chrome** instalado e logado.
3. **Conta Railway** com cartão cadastrado.
4. **Conta OpenAI** com US$ 5 e key copiada.
5. **Chip de WhatsApp dedicado** (não use seu número pessoal).

Sem esses 5, você vai travar. **Faça antes da imersão**.

---

## Como instalar (≈10 cliques, ≈1h)

### 1. Baixe esse template como ZIP

Clique no botão verde **"Code"** no topo da página e depois **"Download ZIP"**. Extraia onde quiser.

### 2. Abra a pasta extraída no Claude Code

`File → Open Folder` → escolha a pasta. Aceite "Trust this folder".

### 3. Diga ao Claude Code:

> *"vamos instalar esse agente"*

Ele vai ler o [`CLAUDE.md`](./CLAUDE.md) e te conduzir do começo ao fim:

- Pede sua OpenAI key (cola no chat, fica privado).
- Te entrega um **prompt mágico** pra você colar no Claude for Chrome.
- O Chrome dirige a Railway sozinho: deploy, espera build, pega URLs.
- Você cola URLs de volta no Claude Code → ele configura o MCP Postgres.
- Reinicia o Claude Code.
- Faz 10 perguntas conversando pra montar a personalidade do agente.
- Te leva pra escanear o QR Code com seu chip.

**Pronto.** Agora você manda mensagem no WhatsApp e o agente responde.

---

## Como editar o agente depois

Tudo dentro do Claude Code, em português, sem deploy:

```
"deixa o agente mais informal"
"adiciona uma skill pra agendamento, horário comercial"
"o cliente +5511999... reclamou — me mostra o que conversaram"
```

Veja [`CLAUDE.md`](./CLAUDE.md) pra mais comandos.

---

## Arquitetura (resumo técnico)

| Camada | Stack |
|---|---|
| Hospedagem | Railway (Postgres + Evolution API + Agente Node) |
| WhatsApp | Evolution API v2.3.7 (não oficial, usa chip) |
| LLM | OpenAI (gpt-4.1-mini chat, whisper-1 áudio, gpt-4o-mini imagem) |
| DB | Postgres (compartilhado entre Evolution e Agente) |
| Linguagem | TypeScript + Fastify |
| Customização | Claude Code app desktop + MCP Postgres |

Detalhes em [`docs/ARQUITETURA.md`](./docs/ARQUITETURA.md).

---

## Suporte

Travou? Veja [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md).

Quer mergulhar a fundo? Veja o **Programa de Implementação** (6 meses, refatora cada peça).
