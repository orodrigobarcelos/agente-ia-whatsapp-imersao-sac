# Como criar o template público na Railway (passo a passo pro Rodrigo)

> **Este arquivo é só pra você, Rodrigo.** Não vai pro aluno. Não compartilhe — depois que terminar e validar o template, pode até deletar esse `.md`.

O objetivo é transformar esse repo num **botão "Deploy on Railway"** que o aluno (via Claude for Chrome) clica e em ~3-5 minutos sobe Postgres + Evolution + Agente já amarrados.

---

## Pré-requisitos

- [ ] Esse repo publicado no **seu GitHub** (público). O Railway vai cloná-lo durante o deploy.
- [ ] Conta Railway com plano **Hobby** ou superior (Free não permite criar templates públicos com volumes).
- [ ] Você logado em [railway.com](https://railway.com).

---

## Etapa 1 — Publica o repo no GitHub

1. Crie um repo público no GitHub (ex: `agente-ia-whatsapp-imersao-sac`).
2. Faça commit/push dessa pasta inteira.
3. **Importante:** confira que `.gitignore` está protegendo `.mcp.json`, `.env`, `.env.local`. Se você fez o teste com a `DATABASE_URL` real, **gire a senha agora** (Railway → Postgres → Variables → regenerate `POSTGRES_PASSWORD`).

```bash
cd /Users/rodrigobarcelos/Documents/agente-ia-whatsapp-imersao-sac
git init
git add .
git commit -m "feat: template simplificado v0.1"
gh repo create agente-ia-whatsapp-imersao-sac --public --source=. --push
```

---

## Etapa 2 — Aponta o `railway.template.json` pro teu repo

Abre `railway.template.json` na raiz e troca o placeholder na seção `services` → `Agente`:

```json
"source": {
  "repo": "SUBSTITUIR_PELO_SEU_USUARIO/SUBSTITUIR_PELO_NOME_DO_REPO"
}
```

Por:

```json
"source": {
  "repo": "orodrigobarcelos/agente-ia-whatsapp-imersao-sac"
}
```

(use seu usuário/repo real). Commit + push de novo.

---

## Etapa 3 — Cria o template público na Railway

### 3.1. Cria um projeto-modelo manualmente (1ª vez)

Antes de virar template, você precisa que **um projeto Railway funcional exista**. Faz assim:

1. Em [railway.com](https://railway.com), clica **New Project**.
2. **Deploy from GitHub repo** → seleciona `agente-ia-whatsapp-imersao-sac`.
3. Quando o serviço subir, **adiciona Postgres**: New → Database → Add PostgreSQL.
4. **Adiciona Evolution**: New → Empty Service → Service Settings → Source: Docker Image → `atendai/evolution-api:v2.3.7` → Volume mount `/evolution/instances`.
5. **Configura variáveis** copiando os valores do `railway.template.json` (campo a campo, manualmente — só dessa vez).
6. **Conecta as referências cross-service**: no Agente, em DATABASE_URL, usa o autocomplete pra escolher `${{Postgres.DATABASE_URL}}`. Mesma coisa pra `EVOLUTION_API_KEY`, `EVOLUTION_URL`, `PUBLIC_URL`.
7. Garante que tudo sobe: Postgres ✅ → Evolution ✅ → Agente ✅ (logs sem erro, `/health` retorna 200, `/qr` mostra a página).
8. Testa o fluxo inteiro: escaneia QR, manda mensagem no WhatsApp, vê o agente responder.

> Esse passo é **manual** porque o template Railway formal precisa de um projeto-base de referência. É chato, mas é uma vez só.

### 3.2. Promove o projeto a Template

1. Com o projeto rodando, vai em **Settings** do projeto → **Templates** → **Create from this Project**.
2. Preenche:
   - **Name:** "Agente IA WhatsApp Simplificado"
   - **Description:** "Template plug-and-play de agente conversacional pra WhatsApp via Evolution + OpenAI + Postgres."
   - **Tags:** `whatsapp`, `ai`, `openai`, `evolution-api`
   - **Icon:** sobe um ícone seu ou usa um genérico.
3. **Configure variáveis de input** (o que o aluno preenche):
   - `OPENAI_API_KEY` → marca como **required**, descrição "Sua chave OpenAI (sk-proj-...)".
   - `AGENT_PROMPT_BOOTSTRAP` → marca como **optional**, default vazio.
   - **Demais variáveis** → marca como **internal** (não aparece pro aluno).
4. **Configure cross-service references** — confira que cada `${{Service.VAR}}` tá apontando certo no JSON gerado pelo Railway.
5. **Save & Publish.**

### 3.3. Testa o template antes de divulgar

1. Pega a URL do template (algo tipo `https://railway.com/template/abc123XYZ`).
2. Abre numa **janela anônima** (ou outra conta Railway).
3. Roda o fluxo do aluno: clica → cola OpenAI key → Deploy → espera build → escaneia QR.
4. Se funcionou: 🎉 template está vivo.
5. Se quebrou: volta no projeto-modelo, ajusta, e re-publica o template.

---

## Etapa 4 — Atualiza os arquivos do kit com a URL do template

Substitui em **2 lugares**:

### 4.1. `PROMPT-DEPLOY.md`

Abre o arquivo, troca **as duas ocorrências** de:

```
https://railway.com/template/SUBSTITUIR_PELO_SEU_TEMPLATE_ID
```

Pela URL real do template (ex: `https://railway.com/template/abc123XYZ`).

### 4.2. `README.md`

Adiciona o badge de deploy no topo (opcional mas bonito):

```markdown
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/abc123XYZ)
```

Commit + push.

---

## Etapa 5 — Distribui pro aluno

Aluno só precisa de **1 link**: a URL do GitHub do template.

> "Vai aqui ó: https://github.com/orodrigobarcelos/agente-ia-whatsapp-imersao-sac — clica em **Code → Download ZIP**, extrai, abre no Claude Code, e diz 'vamos instalar esse agente'."

Pronto.

---

## Manutenção contínua

### Atualizar o template

Sempre que você fizer melhoria no código:

1. Push pro GitHub.
2. Railway → Templates → "Update from current project" (se você atualizou o projeto-modelo) **ou** "Update from repo" (se quer só atualizar o código sem mudar config).
3. Templates já-deployados pelos alunos **não atualizam sozinhos** — eles ficam na versão que clonaram. Se quiser forçar update, comunica os alunos.

### Versionar o template

Use **semver no nome** ("Agente IA WhatsApp v1.2"). Quando uma mudança quebrar compatibilidade (ex: schema novo), publica como **template novo** em vez de atualizar o existente. Aluno antigo continua funcional, aluno novo pega a versão atualizada.

### Métricas

Railway → Templates → seu template → mostra contador de deploys. Útil pra saber quantos alunos usaram.

---

## Troubleshooting comum

### "Build do Agente trava em `npm install`"

Verifica que o `package-lock.json` está commitado e que o Dockerfile usa `npm install` (sem `--frozen-lockfile`). Em projetos novos sem lock prévio, `npm ci` quebra.

### "Evolution não responde"

Garante que o Evolution tem **volume montado** em `/evolution/instances` (instâncias persistem aí). Sem volume, toda restart perde a conexão WhatsApp.

### "Webhook não chega"

Confere que o Agente tem **public domain gerado** (Settings → Networking → Generate). Sem domínio público, `PUBLIC_URL` fica vazia e o bootstrap pula a configuração de webhook.

### "Schema da Evolution conflita com o do Agente"

No `template.json`, a `DATABASE_CONNECTION_URI` da Evolution já tem `?schema=evolution` no final — isso isola as tabelas Evolution num schema separado, sem conflito com `public.agent_configs` etc. Se você editar e remover esse `?schema=evolution`, pode rolar conflito.

---

## Resumo do que você precisa fazer

- [ ] Publicar repo no GitHub
- [ ] Trocar `SUBSTITUIR_PELO_SEU_USUARIO/SUBSTITUIR_PELO_NOME_DO_REPO` no `railway.template.json`
- [ ] Criar projeto-modelo na Railway, validar funcionando
- [ ] Promover a Template público na Railway
- [ ] Anotar a URL do template
- [ ] Atualizar `PROMPT-DEPLOY.md` (2 ocorrências)
- [ ] Atualizar `README.md` (badge opcional)
- [ ] Testar em janela anônima
- [ ] **Girar a senha do Postgres de teste** (a que está no `.mcp.json` local)
- [ ] Distribuir o link do GitHub pros alunos

Boa! 🚀
