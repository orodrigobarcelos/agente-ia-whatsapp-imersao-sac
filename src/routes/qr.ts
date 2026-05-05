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
    .pairing { margin-top: 12px; font-size: 13px; color: #8895aa; }
    .pairing strong { color: #e7ecf3; font-family: ui-monospace, monospace; letter-spacing: 2px; }
    .spinner {
      width: 20px; height: 20px; border: 3px solid #2a3445;
      border-top-color: #6aa6ff; border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block; vertical-align: middle; margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .hint { margin-top: 16px; font-size: 13px; color: #8895aa; }
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
    <div class="pairing" id="pairing" hidden></div>
    <p class="hint">Abra o WhatsApp → Aparelhos conectados → Conectar um aparelho.</p>
  </div>
  <script>
    const qrEl = document.getElementById('qr');
    const statusEl = document.getElementById('status');
    const pairingEl = document.getElementById('pairing');
    let lastQr = '';
    let connected = false;

    async function tickState() {
      try {
        const r = await fetch('/qr/state').then(r => r.json());
        if (r.state === 'open') {
          connected = true;
          statusEl.className = 'status connected';
          statusEl.textContent = '✅ Conectado! Pode fechar essa página.';
          qrEl.innerHTML = '<div style="font-size:64px">✅</div>';
          return true;
        }
        if (r.state === 'connecting') {
          statusEl.textContent = 'Sincronizando com WhatsApp…';
        }
      } catch (e) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Erro consultando status. Tentando de novo…';
      }
      return false;
    }

    async function tickQr() {
      if (connected) return;
      try {
        const r = await fetch('/qr/image').then(r => r.json());
        if (r.base64 && r.base64 !== lastQr) {
          lastQr = r.base64;
          const src = r.base64.startsWith('data:') ? r.base64 : 'data:image/png;base64,' + r.base64;
          qrEl.innerHTML = '<img alt="QR Code" src="' + src + '" />';
        }
        if (r.pairingCode) {
          pairingEl.hidden = false;
          pairingEl.innerHTML = 'Ou use o código de pareamento: <strong>' + r.pairingCode + '</strong>';
        }
      } catch (e) {
        // ignore — tenta de novo no próximo tick
      }
    }

    async function loop() {
      const done = await tickState();
      if (done) return;
      await tickQr();
      setTimeout(loop, 2000);
    }
    loop();
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
