---
name: exemplo
description: SUBSTITUA — texto curto explicando QUANDO essa skill deve ser usada
---

# Exemplo de skill

Esse arquivo é um **template comentado** pra você copiar quando criar uma skill.

## Como funciona

Skills são módulos de conhecimento que o agente carrega **em todo turno** e injeta no system prompt. Use pra:

- **Procedimentos** — ex: "como agendar consulta", "como processar pedido"
- **Conhecimento de domínio** — ex: "tabela de preços", "regras do nosso plano"
- **Tom específico em situações** — ex: "como lidar com objeção de preço"
- **Integrações conversacionais** — ex: "quando cliente pedir reembolso"

## Frontmatter (obrigatório)

```yaml
---
name: nome_curto_sem_acento_em_minusculo
description: Frase curta que explica QUANDO usar essa skill (1 linha)
---
```

- `name` — único por agente (`agent_type`). Vira a chave da skill no DB.
- `description` — usada pelo agente pra "saber" pra que serve. Seja específico.

## Conteúdo

Tudo abaixo do frontmatter vai como `content`. Pode ter:

- Listas
- Tabelas Markdown
- Exemplos de diálogo
- Instruções step-by-step

**Limite recomendado:** ~3000 caracteres por skill. Se passar, divida em duas.

## Como criar de verdade

Você não cria esse arquivo manualmente — você fala com o Claude Code:

> *"cria uma skill pra agendamento de consulta, horário comercial seg-sex 9-18h, peça nome, telefone e dia preferido"*

O Claude Code:
1. Cria o arquivo `skills/agendamento.md` (formato igual a esse)
2. Insere no banco via MCP Postgres
3. Pronto — agente já usa na próxima mensagem (cache 30s)

## Esse arquivo de exemplo

Esse `exemplo.md` **não é carregado pelo agente** — ele só existe como referência local. Skills só viram ativas quando entram na tabela `agent_skills` com `active = true`.
