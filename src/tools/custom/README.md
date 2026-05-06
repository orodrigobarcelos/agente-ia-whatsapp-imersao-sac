# Tools customizadas — espaço do aluno

Esta pasta é onde **suas tools** ficam. Tool = "ferramenta" que o agente pode usar durante a conversa pra executar uma ação real (consultar site, chamar API, calcular, etc).

> ⚠️ **Você não precisa criar isso à mão.** Peça ao Claude Code app desktop:
>
> *"quero uma skill que [acessa site / consulta API / calcula X]"*
>
> Ele cria o arquivo, testa local, comita e dá push pra Railway atualizar.

---

## Skill vs Tool — diferença

| | Skill (texto) | Tool (código) |
|---|---|---|
| **Onde mora** | Banco Postgres | Arquivo em `src/tools/custom/*.ts` |
| **O que faz** | Molda como o agente fala | Executa ação real (HTTP, scraping, cálculo) |
| **Atualiza em** | 30 segundos | ~5 minutos (push + redeploy Railway) |
| **Editável sem código** | ✅ | ❌ |

Você fala "skill" pra tudo. O Claude Code decide qual caminho usar.

---

## Padrão de uma tool

```typescript
// src/tools/custom/consultar-preco.ts
import { registerTool } from '../registry.js';

registerTool({
  name: 'consultar_preco',
  description:
    'Use quando o cliente perguntar o preço de um produto pelo código. ' +
    'Retorna o valor atual em reais.',
  parameters: {
    type: 'object',
    properties: {
      codigo: {
        type: 'string',
        description: 'Código do produto, ex: ABC123',
      },
    },
    required: ['codigo'],
    additionalProperties: false,
  },
  handler: async ({ codigo }) => {
    // ... implementação aqui
    return { preco: 49.9, moeda: 'BRL' };
  },
});
```

E depois adicione **uma linha em `../index.ts`**:

```typescript
import './custom/consultar-preco.js';
```

(Claude Code adiciona essa linha pra você quando cria a tool.)

---

## Limites

- **Timeout:** 5 minutos por execução
- **Erros são capturados** — se sua tool falhar, o agente avisa o cliente que não conseguiu consultar agora
- **NUNCA** coloque chave de API ou senha no código — use `process.env.MINHA_VAR` e configure a variável na Railway
- **Args validados** automaticamente pelo OpenAI strict mode (o que tá no `parameters` chega no handler)

### ⚠️ Strict mode — regras dos `parameters`

O OpenAI valida o JSON Schema com `strict: true`. Pra não quebrar:

1. **`required`** deve listar **TODAS** as keys de `properties` (mesmo as opcionais — pra fazer "opcional" use `type: ['string', 'null']` em vez de remover do required)
2. **`additionalProperties: false`** em **TODO objeto aninhado**, não só na raiz

Exemplo de aninhamento correto:

```typescript
parameters: {
  type: 'object',
  properties: {
    endereco: {
      type: 'object',
      properties: {
        rua: { type: 'string' },
        numero: { type: 'string' },
      },
      required: ['rua', 'numero'],
      additionalProperties: false,  // ← AQUI também
    },
  },
  required: ['endereco'],
  additionalProperties: false,  // ← e aqui
}
```

---

## Tools com Playwright (browser automation)

Tem um template pronto em `_TEMPLATE-playwright.ts.example`. Claude Code usa de base quando você pede tool de scraping. Padrão importante:

- `chromium.launch({ headless: true, args: ['--no-sandbox'] })` (necessário no container Railway)
- Sempre fechar browser em `finally { await browser.close() }` — Chromium come ~200MB RAM
- Timeout de `page.goto` curto (30s) — não dependa do timeout de 5min como crutch

---

## Quando o agente chama sua tool?

O LLM lê o `description` de cada tool registrada e decide. Quanto mais específica e clara a description, mais correta a decisão. Exemplos:

✅ Bom: *"Use quando o cliente perguntar o preço de um produto pelo código de barras."*

❌ Ruim: *"Tool de preço."*
