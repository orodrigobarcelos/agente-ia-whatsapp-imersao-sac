import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { getEvolutionClient } from '../lib/evolution.js';
import { logger } from '../lib/logger.js';

export async function qrRoutes(app: FastifyInstance) {
  app.get('/qr', async (_req, reply) => {
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return renderQrPage(env.EVOLUTION_INSTANCE);
  });

  app.get('/qr/state', async (_req, reply) => {
    try {
      const evolution = getEvolutionClient();
      const result = await evolution.connectionState(env.EVOLUTION_INSTANCE);
      return reply.send({ state: result.state });
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'qr state lookup failed',
      );
      return reply.code(503).send({ state: 'unknown', error: 'evolution_unreachable' });
    }
  });

  app.get('/qr/image', async (_req, reply) => {
    try {
      const evolution = getEvolutionClient();
      const result = await evolution.connectInstance(env.EVOLUTION_INSTANCE);
      const base64 = result.base64 ?? '';
      const code = result.code ?? null;
      const pairingCode = result.pairingCode ?? null;
      return reply.send({ base64, code, pairingCode });
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'qr image fetch failed',
      );
      return reply.code(503).send({ error: 'evolution_unreachable' });
    }
  });

  // Gera um CÓDIGO DE PAREAMENTO (8 dígitos) pra conectar via
  // "Conectar com número de telefone" — caminho alternativo quando o
  // WhatsApp recusa o scan do QR.
  app.get('/qr/pairing-code', async (req, reply) => {
    const raw = (req.query as { number?: unknown }).number;
    const number = String(raw ?? '').replace(/\D/g, '');
    if (number.length < 10 || number.length > 15) {
      return reply.code(400).send({ error: 'invalid_number' });
    }
    try {
      const evolution = getEvolutionClient();

      // Se já está conectado, NÃO mexe — logout aqui derrubaria o agente.
      const state = await evolution.connectionState(env.EVOLUTION_INSTANCE);
      if (state.state === 'open') {
        return reply.send({ alreadyConnected: true });
      }

      // Logout reseta a sessão Baileys: sem isso, a instância presa no
      // modo QR devolve QR de novo em vez do código de pareamento.
      await evolution.logoutInstance(env.EVOLUTION_INSTANCE);
      await new Promise((r) => setTimeout(r, 3_000));

      const result = await evolution.connectInstance(env.EVOLUTION_INSTANCE, number);
      const pairingCode = result.pairingCode ?? null;
      if (!pairingCode) {
        logger.warn({ number }, 'pairing code came back empty');
        return reply.code(502).send({ error: 'no_pairing_code' });
      }
      return reply.send({ pairingCode });
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'pairing code generation failed',
      );
      return reply.code(503).send({ error: 'evolution_unreachable' });
    }
  });
}

function renderQrPage(instanceName: string): string {
  return /* html */ `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Conectar WhatsApp — ${escapeHtml(instanceName)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #0b0f17; color: #e7ecf3; padding: 24px;
    }
    .card {
      background: #131a26; border: 1px solid #1f2a3a; border-radius: 16px;
      padding: 32px; max-width: 460px; width: 100%; text-align: center;
      box-shadow: 0 20px 50px rgba(0,0,0,0.4);
    }
    h1 { font-size: 22px; margin: 0 0 8px; }
    .muted { color: #8895aa; font-size: 14px; margin: 0 0 24px; }
    .qr-wrap {
      background: #fff; border-radius: 12px; padding: 16px;
      display: grid; place-items: center; min-height: 280px;
    }
    .qr-wrap img { max-width: 100%; height: auto; display: block; }
    .status {
      margin-top: 20px; padding: 12px 16px; border-radius: 10px;
      font-size: 14px; font-weight: 500;
    }
    .status.waiting   { background: #1f2a3a; color: #e7ecf3; }
    .status.connected { background: #1a3a2a; color: #8be4a8; }
    .status.error     { background: #3a1f24; color: #ffb4be; }
    .spinner {
      width: 20px; height: 20px; border: 3px solid #2a3445;
      border-top-color: #6aa6ff; border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block; vertical-align: middle; margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .hint { margin-top: 16px; font-size: 13px; color: #8895aa; }
    /* ─── Alternativa: código de pareamento ─── */
    .alt {
      margin-top: 24px; padding-top: 20px; border-top: 1px solid #1f2a3a;
      text-align: left;
    }
    .alt summary {
      cursor: pointer; font-size: 14px; color: #6aa6ff; font-weight: 500;
      list-style: none; text-align: center;
    }
    .alt summary::-webkit-details-marker { display: none; }
    .alt-body { margin-top: 16px; }
    .alt-body p { font-size: 13px; color: #8895aa; margin: 0 0 12px; }
    .alt-row { display: flex; gap: 8px; }
    .alt input {
      flex: 1; background: #0b0f17; border: 1px solid #2a3445; color: #e7ecf3;
      border-radius: 8px; padding: 10px 12px; font-size: 14px;
    }
    .alt button {
      background: #6aa6ff; color: #06101f; border: none; border-radius: 8px;
      padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer;
      white-space: nowrap;
    }
    .alt button:disabled { opacity: 0.5; cursor: default; }
    .pair-result {
      margin-top: 16px; padding: 16px; border-radius: 10px;
      background: #1f2a3a; text-align: center;
    }
    .pair-code {
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 30px; font-weight: 700; letter-spacing: 4px; color: #8be4a8;
      margin: 8px 0;
    }
    .pair-steps { font-size: 12px; color: #8895aa; margin-top: 10px; line-height: 1.6; }
    .pair-result.error { background: #3a1f24; }
    .pair-result.error .pair-code { color: #ffb4be; font-size: 15px; letter-spacing: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📱 Conectar WhatsApp</h1>
    <p class="muted">Instância <code>${escapeHtml(instanceName)}</code></p>
    <div class="qr-wrap" id="qr">
      <span><span class="spinner"></span>gerando QR Code…</span>
    </div>
    <div class="status waiting" id="status">Aguardando você escanear…</div>
    <p class="hint">Abra o WhatsApp → Aparelhos conectados → Conectar um aparelho.</p>

    <details class="alt">
      <summary>O QR não funciona? Conectar pelo número de telefone</summary>
      <div class="alt-body">
        <p>
          Se o WhatsApp recusar o QR, gere um código de pareamento. Digite o
          número do chip do agente, com DDI e DDD, só números.
        </p>
        <div class="alt-row">
          <input id="phone" inputmode="numeric" autocomplete="off"
                 placeholder="Ex: 5511999999999" />
          <button id="pairBtn" type="button">Gerar código</button>
        </div>
        <div class="pair-result" id="pairResult" hidden></div>
      </div>
    </details>
  </div>
  <script>
    const qrEl = document.getElementById('qr');
    const statusEl = document.getElementById('status');
    const phoneEl = document.getElementById('phone');
    const pairBtn = document.getElementById('pairBtn');
    const pairResultEl = document.getElementById('pairResult');
    let lastQr = '';
    let lastState = '';
    // Quando o aluno gera um código de pareamento, paramos de buscar QR
    // (o polling chamaria connect sem número e poderia atrapalhar a sessão).
    let pairingMode = false;

    function setQrPlaceholder(text) {
      qrEl.innerHTML = '<span><span class="spinner"></span>' + text + '</span>';
      lastQr = '';
    }

    async function tickState() {
      try {
        const r = await fetch('/qr/state').then(r => r.json());
        const state = r.state || 'unknown';
        if (state !== lastState) {
          if (state === 'open') {
            statusEl.className = 'status connected';
            statusEl.textContent = '✅ Conectado! Pode fechar essa página.';
            qrEl.innerHTML = '<div style="font-size:64px">✅</div>';
          } else if (state === 'connecting') {
            statusEl.className = 'status waiting';
            statusEl.textContent = 'Sincronizando com WhatsApp…';
            if (!pairingMode) setQrPlaceholder('aguardando…');
          } else {
            statusEl.className = 'status waiting';
            statusEl.textContent = 'Aguardando você escanear…';
            if (!pairingMode &&
                qrEl.querySelector('img') === null &&
                qrEl.querySelector('.spinner') === null) {
              setQrPlaceholder('gerando QR Code…');
            }
          }
          lastState = state;
        }
        return state;
      } catch (e) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Erro consultando status. Tentando de novo…';
        return 'error';
      }
    }

    async function tickQr() {
      try {
        const r = await fetch('/qr/image').then(r => r.json());
        if (r.base64 && r.base64 !== lastQr) {
          lastQr = r.base64;
          const src = r.base64.startsWith('data:') ? r.base64 : 'data:image/png;base64,' + r.base64;
          qrEl.innerHTML = '<img alt="QR Code" src="' + src + '" />';
        }
      } catch (e) {
        // ignore — tenta de novo no próximo tick
      }
    }

    async function loop() {
      const state = await tickState();
      // Buscar QR só quando NÃO conectado E não estamos no modo pareamento.
      if (state !== 'open' && !pairingMode) {
        await tickQr();
      }
      setTimeout(loop, 2000);
    }
    loop();

    // ─── Código de pareamento ───────────────────────────────────────
    function showPairError(msg) {
      pairResultEl.hidden = false;
      pairResultEl.className = 'pair-result error';
      pairResultEl.innerHTML = '<div class="pair-code">' + msg + '</div>';
    }

    async function generatePairingCode() {
      const number = (phoneEl.value || '').replace(/\\D/g, '');
      if (number.length < 10 || number.length > 15) {
        showPairError('Número inválido. Use DDI+DDD, só números. Ex: 5511999999999');
        return;
      }
      pairBtn.disabled = true;
      pairBtn.textContent = 'Gerando…';
      pairResultEl.hidden = true;
      try {
        const r = await fetch('/qr/pairing-code?number=' + encodeURIComponent(number));
        const data = await r.json();
        if (data.alreadyConnected) {
          showPairError('Esse agente já está conectado.');
        } else if (data.pairingCode) {
          pairingMode = true;
          const c = data.pairingCode;
          const pretty = c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c;
          pairResultEl.hidden = false;
          pairResultEl.className = 'pair-result';
          pairResultEl.innerHTML =
            '<div>Digite esse código no WhatsApp:</div>' +
            '<div class="pair-code">' + pretty + '</div>' +
            '<div class="pair-steps">' +
            'No celular: WhatsApp → Aparelhos conectados → Conectar um ' +
            'aparelho → <b>Conectar com número de telefone</b> → digite o ' +
            'código acima. O código expira em poucos minutos.' +
            '</div>';
          qrEl.innerHTML = '<div style="color:#06101f;font-size:14px;' +
            'padding:20px;text-align:center">Use o código de pareamento ' +
            'abaixo 👇</div>';
        } else if (data.error === 'invalid_number') {
          showPairError('Número inválido. Use DDI+DDD, só números.');
        } else {
          showPairError('Não consegui gerar o código agora. Tente de novo em 1 min.');
        }
      } catch (e) {
        showPairError('Erro de conexão. Tente de novo.');
      } finally {
        pairBtn.disabled = false;
        pairBtn.textContent = 'Gerar código';
      }
    }

    pairBtn.addEventListener('click', generatePairingCode);
    phoneEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') generatePairingCode();
    });
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
