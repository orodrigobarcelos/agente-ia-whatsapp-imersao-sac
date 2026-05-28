# Galeria de Tools — exemplos prontos

> Inspiração de tools que dá pra criar pelo Claude Code dizendo *"quero uma skill que [...]"*. Não copie crua — adapte URL/parâmetros à tua realidade.

---

## 1. Consultar CEP (ViaCEP, sem Playwright)

**Caso:** cliente manda CEP, agente devolve endereço completo.

**Aluno diz:** *"quero uma skill que consulta o endereço pelo CEP"*

```typescript
import { registerTool } from '../registry.js';

registerTool({
  name: 'consultar_cep',
  description:
    'Use quando o cliente informar um CEP (8 dígitos) e quiser saber o endereço — rua, bairro, cidade, estado.',
  parameters: {
    type: 'object',
    properties: {
      cep: {
        type: 'string',
        description: 'CEP só com dígitos, ex: 01310100',
      },
    },
    required: ['cep'],
    additionalProperties: false,
  },
  handler: async ({ cep }) => {
    const cepLimpo = String(cep).replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      return { ok: false, erro: 'CEP precisa ter 8 dígitos' };
    }
    const r = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await r.json() as Record<string, unknown>;
    if (data.erro) return { ok: false, erro: 'CEP não encontrado' };
    return {
      ok: true,
      rua: data.logradouro,
      bairro: data.bairro,
      cidade: data.localidade,
      estado: data.uf,
    };
  },
});
```

---

## 2. Calcular frete (API hipotética, fetch HTTP)

**Caso:** cliente pergunta valor de entrega pra CEP dele, agente calcula via API da loja.

```typescript
import { registerTool } from '../registry.js';

registerTool({
  name: 'calcular_frete',
  description:
    'Use quando o cliente quiser saber o valor do frete pra um CEP específico. ' +
    'Retorna preço e prazo em dias úteis.',
  parameters: {
    type: 'object',
    properties: {
      cep_destino: { type: 'string', description: 'CEP de destino, 8 dígitos' },
      peso_kg: { type: 'number', description: 'Peso aproximado em kg, ex: 1.5' },
    },
    required: ['cep_destino', 'peso_kg'],
    additionalProperties: false,
  },
  handler: async ({ cep_destino, peso_kg }) => {
    const r = await fetch('https://api.minha-loja.com/frete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LOJA_API_KEY}`,
      },
      body: JSON.stringify({ cep: cep_destino, peso: peso_kg }),
    });
    const data = await r.json();
    return {
      preco_reais: data.valor,
      prazo_dias_uteis: data.prazo,
      transportadora: data.transportadora,
    };
  },
});
```

> **Atenção:** `LOJA_API_KEY` precisa estar configurada como env var na Railway. Nunca hardcode chave no código.

---

## 3. Status de pedido (API interna da empresa)

**Caso:** cliente pergunta onde tá o pedido dele, agente consulta sistema.

```typescript
import { registerTool } from '../registry.js';

registerTool({
  name: 'status_pedido',
  description:
    'Use quando o cliente perguntar onde está o pedido dele, fornecendo o número. ' +
    'Retorna status atual e código de rastreio se já enviou.',
  parameters: {
    type: 'object',
    properties: {
      numero_pedido: {
        type: 'string',
        description: 'Número do pedido, formato PED-XXXXX ou só dígitos',
      },
    },
    required: ['numero_pedido'],
    additionalProperties: false,
  },
  handler: async ({ numero_pedido }) => {
    const r = await fetch(
      `https://meu-erp.com/api/pedidos/${numero_pedido}`,
      {
        headers: { 'X-API-Key': process.env.ERP_API_KEY ?? '' },
      },
    );
    if (r.status === 404) return { ok: false, erro: 'pedido não encontrado' };
    const data = await r.json();
    return {
      ok: true,
      status: data.status,
      data_pedido: data.criado_em,
      data_envio: data.enviado_em ?? null,
      rastreio: data.codigo_rastreio ?? null,
      previsao_entrega: data.previsao ?? null,
    };
  },
});
```

---

## 4. Preço de produto via scraping (Playwright)

> ℹ️ A fonte canônica e mais completa é `src/tools/custom/_TEMPLATE-playwright.ts.example`
> — ele tem TODAS as defesas comentadas. Use ele como base ao criar tools de scraping.

**Caso:** loja sem API. Agente abre o site, navega até o produto, extrai preço.

**Aluno diz:** *"quero uma skill que consulta o preço do produto X no site Y"*

```typescript
/// <reference lib="dom" />
// @ts-ignore — playwright-extra não publica types completas
import { chromium } from 'playwright-extra';
// @ts-ignore — plugin sem types oficiais
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { registerTool } from '../registry.js';

// Stealth disfarça sinais de automação e passa pelo Cloudflare Turnstile
// na maioria dos sites. Registrado uma vez no boot do módulo.
chromium.use(StealthPlugin());

registerTool({
  name: 'preco_produto_concorrente',
  description:
    'Use quando o cliente perguntar o preço de um produto disponível em www.concorrente.com pelo código.',
  parameters: {
    type: 'object',
    properties: {
      codigo: { type: 'string', description: 'Código do produto (SKU)' },
    },
    required: ['codigo'],
    additionalProperties: false,
  },
  handler: async ({ codigo }) => {
    if (typeof codigo !== 'string' || codigo.trim().length === 0) {
      return { ok: false, erro: 'parametro_invalido', detalhe: 'código vazio' };
    }
    const sku = codigo.trim();

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'pt-BR',
      });
      const page = await context.newPage();
      await page.goto(`https://www.concorrente.com/produto/${sku}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      // Espera o MARCADOR de conteúdo real (o preço), não só waitUntil.
      // Trata a splash "Um momento..." do Cloudflare com um reload de fallback.
      let carregou = false;
      try {
        await page.waitForFunction(
          () => document.querySelector('.preco-atual') !== null,
          { timeout: 20_000 },
        );
        carregou = true;
      } catch {
        const txt = await page.evaluate(() => document.body.innerText);
        if (/um momento|carregando/i.test(txt)) {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
          try {
            await page.waitForFunction(
              () => document.querySelector('.preco-atual') !== null,
              { timeout: 20_000 },
            );
            carregou = true;
          } catch {
            /* cai no erro estruturado abaixo */
          }
        }
      }

      if (!carregou) {
        console.log('[preco_produto_concorrente] não carregou:', sku);
        return {
          ok: false,
          erro: 'pagina_nao_carregou',
          detalhe: `Não consegui carregar o produto ${sku}. Confere o código ou tenta de novo.`,
        };
      }

      const precoTexto = (await page.textContent('.preco-atual'))?.trim() ?? null;
      const disponivel = await page.isVisible('.botao-comprar');

      // Valida ANTES de retornar — preço vazio = falha explícita, não dado errado.
      if (!precoTexto) {
        console.log('[preco_produto_concorrente] preço ausente:', sku);
        return {
          ok: false,
          erro: 'preco_indisponivel',
          detalhe: `Achei a página do produto ${sku} mas não li o preço. O site pode ter mudado de layout.`,
        };
      }

      const resultado = { ok: true, codigo: sku, preco: precoTexto, disponivel };
      console.log('[preco_produto_concorrente] extraiu:', JSON.stringify(resultado));
      return resultado;
    } finally {
      await browser.close(); // SEMPRE fecha — Chromium come ~200MB de RAM
    }
  },
});
```

---

## 5. Conversão de moeda (cotação ao vivo)

**Caso:** cliente pergunta valor em USD/EUR, agente devolve em BRL com cotação atual.

```typescript
import { registerTool } from '../registry.js';

registerTool({
  name: 'cotacao_moeda',
  description:
    'Use quando o cliente perguntar a cotação atual de USD, EUR, GBP ou ARS em reais. ' +
    'Retorna valor da moeda em BRL.',
  parameters: {
    type: 'object',
    properties: {
      moeda: {
        type: 'string',
        enum: ['USD', 'EUR', 'GBP', 'ARS'],
        description: 'Sigla da moeda',
      },
    },
    required: ['moeda'],
    additionalProperties: false,
  },
  handler: async ({ moeda }) => {
    // API gratuita do AwesomeAPI, sem auth
    const r = await fetch(`https://economia.awesomeapi.com.br/last/${moeda}-BRL`);
    const data = await r.json() as Record<string, { ask: string; bid: string }>;
    const par = data[`${moeda}BRL`];
    if (!par) return { ok: false, erro: 'cotação indisponível' };
    return {
      ok: true,
      moeda,
      compra_brl: parseFloat(par.bid),
      venda_brl: parseFloat(par.ask),
    };
  },
});
```

---

## 6. Calculadora financeira (cálculo puro, sem rede)

**Caso:** cliente pergunta valor de parcelas, agente calcula.

```typescript
import { registerTool } from '../registry.js';

registerTool({
  name: 'calcular_parcelas',
  description:
    'Use quando o cliente pedir simulação de parcelamento. ' +
    'Calcula valor da parcela mensal usando juros compostos.',
  parameters: {
    type: 'object',
    properties: {
      valor_total: { type: 'number', description: 'Valor total em reais' },
      parcelas: { type: 'integer', description: 'Número de parcelas (1 a 24)' },
      juros_mes_pct: {
        type: 'number',
        description: 'Taxa de juros mensal em %, ex: 1.99',
      },
    },
    required: ['valor_total', 'parcelas', 'juros_mes_pct'],
    additionalProperties: false,
  },
  handler: async ({ valor_total, parcelas, juros_mes_pct }) => {
    const v = Number(valor_total);
    const n = Number(parcelas);
    const i = Number(juros_mes_pct) / 100;
    if (i === 0) {
      return {
        valor_parcela: +(v / n).toFixed(2),
        total_pago: v,
        total_juros: 0,
      };
    }
    const parcela = (v * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    const total = parcela * n;
    return {
      valor_parcela: +parcela.toFixed(2),
      total_pago: +total.toFixed(2),
      total_juros: +(total - v).toFixed(2),
    };
  },
});
```

---

## 7. Disponibilidade de horário (consulta calendário interno)

**Caso:** cliente quer marcar consulta, agente verifica horários livres da semana.

```typescript
import { registerTool } from '../registry.js';

registerTool({
  name: 'horarios_disponiveis',
  description:
    'Use quando o cliente quiser saber horários livres pra agendar nesta semana ou na próxima. ' +
    'Retorna lista de slots disponíveis.',
  parameters: {
    type: 'object',
    properties: {
      semana: {
        type: 'string',
        enum: ['esta', 'proxima'],
        description: 'Qual semana consultar',
      },
      profissional: {
        type: ['string', 'null'],
        description: 'Nome do profissional, ou null pra qualquer',
      },
    },
    required: ['semana', 'profissional'],
    additionalProperties: false,
  },
  handler: async ({ semana, profissional }) => {
    const r = await fetch(`${process.env.AGENDA_API_URL}/disponibilidade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.AGENDA_API_KEY ?? '',
      },
      body: JSON.stringify({ semana, profissional }),
    });
    const data = await r.json();
    return {
      slots: data.slots, // [{data, hora, profissional}, ...]
      total_disponivel: data.slots.length,
    };
  },
});
```

---

## Padrões que funcionam

✅ **Description objetiva e específica** — *"Use quando o cliente perguntar X e fornecer Y"*. Quanto mais condicional, mais o LLM acerta o momento.

✅ **Sempre retorna `ok: true/false`** quando faz sentido — LLM lida bem com fail explícito.

✅ **Sempre fechar Playwright** em `finally { await browser.close() }` — Chromium come 200MB de RAM por instância.

✅ **Validação de input no handler** — mesmo com strict mode, valide formatos (CEP, número de pedido, etc.) antes de fazer chamada externa.

✅ **`process.env.MINHA_VAR`** pra credenciais — configurar na Railway, nunca hardcode.

## Padrões que dão problema

❌ **Description vaga** (*"tool de preço"*) — LLM não sabe quando chamar.

❌ **Esquecer `additionalProperties: false`** em objeto aninhado — OpenAI rejeita.

❌ **Hardcode de credencial** — vaza pro repo do aluno.

❌ **Não fechar Playwright** — vaza RAM, derruba container.

❌ **Tool muito genérica** (*"executa ação X com argumento Y"*) — LLM passa args errados, vira jogo de adivinhação.
