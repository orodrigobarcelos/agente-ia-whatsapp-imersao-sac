# Checklist — antes da imersão

Faça isso **na semana anterior**. Sem essas 5 coisas prontas, você não consegue terminar a instalação no dia.

---

## 1. Anthropic Pro + Claude Code app desktop

**Por quê:** o Claude Code é quem te conduz de ponta a ponta — entrevista, configura, edita o agente.

- [ ] Tenho conta Anthropic com plano **Pro** (mínimo). [claude.com/upgrade](https://claude.com/upgrade)
- [ ] Baixei o Claude Code app desktop. [claude.com/download](https://claude.com/download)
- [ ] Abri o app pelo menos 1 vez e fiz login.

---

## 2. Claude for Chrome (extensão)

**Por quê:** ela dirige a Railway pra você (login, deploy, copiar URLs). Sem ela você teria que fazer ~15 cliques manuais.

- [ ] Instalei a extensão Claude for Chrome. [claude.com/chrome](https://claude.com/chrome)
- [ ] Logado com a mesma conta Anthropic.
- [ ] Já abri uma vez e dei as permissões pedidas.

---

## 3. Conta Railway com cartão cadastrado

**Por quê:** é onde teu agente vai morar. Cartão é exigido **mesmo no plano free** pra verificação.

- [ ] Criei conta em [railway.com](https://railway.com).
- [ ] Adicionei cartão (Settings → Plans → Add Payment Method).
- [ ] Verifiquei que minha conta não está travada por verificação (login → consegue criar projeto).

> **Custo:** ~US$ 5/mês de uso típico (Postgres pequeno + Evolution + agente). Plano free dá ~30 dias.

---

## 4. Conta OpenAI com US$ 5 e API key

**Por quê:** o agente usa GPT pra conversar e Whisper pra transcrever áudios. Mínimo de saldo: $5.

- [ ] Criei conta em [platform.openai.com](https://platform.openai.com).
- [ ] Adicionei US$ 5 em Billing → Add to credit balance.
- [ ] Gerei uma API key em [API Keys](https://platform.openai.com/api-keys).
- [ ] Copiei a key (começa com `sk-proj-...`) e guardei em lugar seguro.

> **Importante:** essa key aparece **só uma vez** quando você gera. Se perdeu, gera outra.

---

## 5. Chip de WhatsApp dedicado

**Por quê:** o agente conecta via Evolution API (não oficial), que assume controle do número. **Não use seu chip pessoal** — risco de ban Meta + você perde o WhatsApp pessoal.

- [ ] Comprei um chip novo (ou separei um que não uso).
- [ ] Inseri o chip num celular qualquer (pode ser o seu mesmo, em modo dual SIM, ou um celular antigo).
- [ ] Ativei o WhatsApp nesse chip, recebi código por SMS, conta criada.
- [ ] **Esse celular vai ficar comigo durante a instalação** (vou escanear QR Code).

> **Dica:** se for usar pra negócio sério, instala WhatsApp Business no chip — mensagem de "fora do ar" automática quando o agente cair fica mais profissional.

---

## Tudo marcado?

Se tudo acima tá ✅, você está pronto. Na hora da imersão, abre esse projeto no Claude Code e diz:

> *"vamos instalar esse agente"*
