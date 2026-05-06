# Como funcionam as Tools

> Pra entender o que o Claude Code faz quando você diz "quero uma skill que [acessa site / consulta API / calcula X]". Curto e técnico.

---

## Skill texto vs Tool código — TL;DR

Você (aluno) fala "skill" pra tudo. Claude Code decide silenciosamente:

| | **Skill TEXTO** | **Skill com CÓDIGO (Tool)** |
|---|---|---|
| **Onde mora** | Postgres `agent_skills` | `src/tools/custom/*.ts` no teu GitHub |
| **O que faz** | Molda **como** o agente fala (texto que vai pro system prompt) | **Executa código** — fetch HTTP, scraping com Playwright, cálculo |
| **Quando ativa** | ~30s (cache no agente) | ~5 min (push + Railway redeploy) |
| **Editável sem código** | ✅ Sim, via MCP Postgres | ❌ Precisa edit + commit + push |
| **Casos de uso** | FAQ, persona, roteiro de venda, regras de negócio estáticas | Consultar preço em tempo real, calcular frete via API, buscar status de pedido, scraping de site |

**Pergunta-guia interna do Claude Code:**
> *"Você precisa que ele CONSULTE algo em tempo real (site, API, sistema teu) ou só RESPONDA com info que você já tem?"*

- **Tem em mãos** → Skill texto.
- **Precisa buscar** → Tool código.

---

## Anatomia de uma tool

Cada arquivo em `src/tools/custom/` é uma tool. Padrão:

```typescript
import { registerTool } from '../registry.js';

registerTool({
  // Nome único (snake_case). LLM usa pra invocar.
  name: 'consultar_preco',

  // Descrição que o LLM lê pra decidir QUANDO chamar.
  // Quanto mais clara, melhor a decisão.
  description:
    'Use quando o cliente perguntar o preço atual de um produto pelo código. ' +
    'Retorna o valor em reais.',

  // JSON Schema dos argumentos (strict mode OpenAI).
  parameters: {
    type: 'object',
    properties: {
      codigo: {
        type: 'string',
        description: 'Código do produto, ex: ABC123',
      },
    },
    required: ['codigo'],            // TODAS as keys de properties
    additionalProperties: false,     // OBRIGATÓRIO em strict mode
  },

  // Função que executa de verdade. Args já validados pelo OpenAI.
  handler: async ({ codigo }) => {
    const r = await fetch(`https://api.exemplo.com/preco/${codigo}`);
    const data = await r.json();
    return { preco: data.value, moeda: 'BRL' };
  },
});
```

E uma linha em `src/tools/index.ts` registra:
```typescript
import './custom/consultar-preco.js';
```

---

## O fluxo no agente (runtime)

Quando o cliente manda mensagem no WhatsApp:

```
1. Cliente: "qual o preço do ABC123?"
                  ↓
2. Webhook Evolution → Agente
                  ↓
3. Agente monta system prompt (skills texto incluídas) +
   tool specs (registry de tools) → manda pro OpenAI
                  ↓
4. OpenAI gpt-4.1-mini decide:
   "preciso da tool consultar_preco com {codigo: 'ABC123'}"
                  ↓
5. Agente roda consultarPreco({codigo: 'ABC123'}) localmente
   → fetch HTTP / Playwright / cálculo
   → retorna {preco: 49.9, moeda: 'BRL'}
                  ↓
6. Agente devolve resultado pro OpenAI
                  ↓
7. OpenAI gera resposta final em JSON estruturado:
   {mensagens: ["tá custando R$49,90 hoje", "vai querer? 🙂"]}
                  ↓
8. Agente envia mensagens via Evolution → WhatsApp
```

Tempo total típico: **5-30 segundos** (depende da tool — Playwright em site lento estoura mais).

---

## Limites e regras

| | Valor |
|---|---|
| Timeout por tool | **5 minutos** |
| Max rounds de tool calling | **3** (depois força resposta sem tools) |
| Tools simultâneas por turno | LLM pode chamar várias em paralelo |
| Erro de tool | Capturado — vira `{ok: false, error}` pro LLM lidar |
| Cliente vê durante execução | Status "está digitando…" via `sendPresence` |

### Strict mode OpenAI (não negociável)

Pra cada tool funcionar, o JSON Schema precisa:

1. `additionalProperties: false` em **TODO** objeto aninhado (não só raiz)
2. `required: [...]` lista 100% das keys de `properties`
3. Pra opcional: usa `type: ['string', 'null']` em vez de remover do `required`

Se quebrar isso, OpenAI rejeita a request com erro `Schema is invalid`.

---

## Lifecycle: criar → testar → deploy

```
Aluno pede no Claude Code
    ↓
Claude Code pergunta detalhes (URL, parâmetros, dado a extrair)
    ↓
Detecta máquina do aluno: Node? Chromium baixado?
    ↓
Cria src/tools/custom/<nome>.ts (template ou fetch puro)
    ↓
Adiciona import no src/tools/index.ts
    ↓
Testa local (se Node disponível): npx tsx ...
    ↓
Aluno aprova
    ↓
git add + commit + push pro repo privado
    ↓
Railway detecta push → builda (5min) → redeploya
    ↓
Tool ativa no agente
```

Sem Node na máquina? Pula teste local, sobe direto, monitora log Railway.

---

## Por que não tudo via skill texto?

Skill texto **não executa código**. Se você diz na skill *"quando cliente pedir preço, consulta o site X"*, o LLM **lê a instrução** mas:

- Não tem como abrir um navegador
- Não tem como fazer HTTP
- Vai inventar valores ou prometer "vou consultar e te confirmo" sem nunca consultar

Pra **realmente agir no mundo**, precisa tool. Não tem atalho.

---

## Quando NÃO criar tool

Antes de criar uma tool, pergunte:

- **A info muda raro?** (1x por mês ou menos) → skill texto basta. Atualiza manual.
- **A consulta é cara?** (Playwright em site protegido, API com rate limit) → talvez melhor o aluno (humano) responder via pause/resume IA.
- **O dado é confidencial?** (CPF, dados sensíveis) → tool exige cuidado extra com env vars de credencial.
- **Já tem skill texto que cobre 80%?** → talvez ajustar a skill seja mais barato que criar tool.

---

## Ver tools ativas no projeto

```bash
# Built-in (vêm de fábrica):
ls src/tools/builtin/

# Suas tools custom:
ls src/tools/custom/*.ts 2>/dev/null

# Imports ativos no registry:
grep "import './" src/tools/index.ts
```

Ou peça ao Claude Code: *"lista todas as skills ativas"* — ele renderiza tabela unificada (texto + tools).

---

## Mais

- Galeria de exemplos: [`EXEMPLOS-DE-TOOLS.md`](./EXEMPLOS-DE-TOOLS.md)
- Padrão técnico no `src/tools/custom/README.md`
- Template Playwright em `src/tools/custom/_TEMPLATE-playwright.ts.example`
