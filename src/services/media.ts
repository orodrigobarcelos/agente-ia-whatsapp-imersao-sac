/**
 * Processamento de mídia recebida via Evolution API.
 *
 * Tipos suportados:
 *   - audioMessage    → Whisper (texto)
 *   - imageMessage    → GPT-4o-mini Vision (descrição)
 *   - stickerMessage  → GPT-4o-mini Vision (descrição curta)
 *   - documentMessage → roteado por mimetype:
 *       image/* → Vision
 *       audio/* → Whisper
 *       outros (PDF/DOCX/XLSX/PPTX) → OpenAI Responses API com input_file
 *   - videoMessage    → fallback com metadata (descrição em texto)
 *
 * Vídeo via Gemini foi REMOVIDO no template simplificado pra cortar uma chave
 * de API. Pra reativar, copie a função describeVideoGemini do repo original.
 */
import { logger } from '../lib/logger.js';
import { getEvolutionClient } from '../lib/evolution.js';
import { getOpenAIClient } from '../lib/openai.js';

const WHISPER_MODEL = 'whisper-1';
const VISION_MODEL = 'gpt-4o-mini';

const VISION_PROMPT =
  'Descreva esta imagem de forma objetiva, em português, em no máximo 3 frases. ' +
  'Se houver texto na imagem, transcreva o texto literalmente. Se for um print de conversa, ' +
  'liste o conteúdo principal. Não adicione opiniões ou interpretações.';

const STICKER_PROMPT =
  'Descreva esta figurinha de forma objetiva em português, em uma frase curta. ' +
  'Se for uma figurinha com texto, inclua o texto.';

export interface MediaProcessingResult {
  text: string;
  transcription: string | null;
  mediaUrl: string | null;
}

interface EvolutionBase64Response {
  base64?: string;
  mimetype?: string;
  mimeType?: string;
}

const PROCESSABLE_MEDIA = new Set([
  'audioMessage',
  'imageMessage',
  'stickerMessage',
  'documentMessage',
  'videoMessage',
]);

async function downloadMediaBase64(params: {
  instance: string;
  messageId: string;
  convertToMp4?: boolean;
}): Promise<{ base64: string; mimeType: string } | null> {
  const evolution = getEvolutionClient();
  const url = `${evolution.baseUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(params.instance)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evolution.apiKey,
      },
      body: JSON.stringify({
        message: { key: { id: params.messageId } },
        convertToMp4: params.convertToMp4 ?? false,
      }),
    });

    if (!response.ok) {
      logger.warn(
        { status: response.status, instance: params.instance, message_id: params.messageId },
        'evolution getBase64FromMediaMessage failed',
      );
      return null;
    }

    const data = (await response.json()) as EvolutionBase64Response;
    const base64 = data.base64 ?? '';
    if (!base64) return null;

    const mimeType = data.mimetype ?? data.mimeType ?? 'application/octet-stream';
    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
    return { base64: cleanBase64, mimeType };
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'downloadMediaBase64 threw',
    );
    return null;
  }
}

function pickAudioExtension(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('wav')) return 'wav';
  return 'ogg';
}

async function transcribeAudio(params: {
  openaiKey: string;
  base64: string;
  mimeType: string;
}): Promise<string | null> {
  const buffer = Buffer.from(params.base64, 'base64');
  const ext = pickAudioExtension(params.mimeType);
  const file = new File([buffer], `audio.${ext}`, { type: params.mimeType });

  const client = getOpenAIClient(params.openaiKey);
  try {
    const response = await client.audio.transcriptions.create({
      file,
      model: WHISPER_MODEL,
      language: 'pt',
    });
    return response.text?.trim() || null;
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'whisper transcription failed',
    );
    return null;
  }
}

async function describeImage(params: {
  openaiKey: string;
  base64: string;
  mimeType: string;
  prompt?: string;
  maxTokens?: number;
}): Promise<string | null> {
  const dataUrl = `data:${params.mimeType};base64,${params.base64}`;
  const client = getOpenAIClient(params.openaiKey);
  try {
    const response = await client.chat.completions.create({
      model: VISION_MODEL,
      max_tokens: params.maxTokens ?? 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: params.prompt ?? VISION_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
          ],
        },
      ],
    });
    return response.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'vision description failed',
    );
    return null;
  }
}

async function describeDocumentResponses(params: {
  openaiKey: string;
  base64: string;
  mimeType: string;
  fileName: string;
}): Promise<string | null> {
  const body = {
    model: 'gpt-4o',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_file',
            filename: params.fileName,
            file_data: `data:${params.mimeType || 'application/pdf'};base64,${params.base64}`,
          },
          {
            type: 'input_text',
            text:
              'Extraia e descreva todo o conteúdo deste documento de forma detalhada e organizada em português. ' +
              'Sua função é APENAS retornar o conteúdo do documento, sem introduções, comentários ou explicações. ' +
              'Comece diretamente com o conteúdo. Mantenha a estrutura original (títulos, tabelas, listas). ' +
              'Se for uma planilha, descreva os dados e colunas. Se for uma apresentação, descreva cada slide.',
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errBody = await response.text();
      logger.warn(
        { status: response.status, body: errBody.slice(0, 300) },
        'openai responses (document) failed',
      );
      return null;
    }
    const data = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
    };
    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      return data.output_text.trim();
    }
    const textChunks =
      data.output?.flatMap((o) =>
        (o.content ?? [])
          .filter((c) => typeof c.text === 'string')
          .map((c) => c.text as string),
      ) ?? [];
    const joined = textChunks.join('\n').trim();
    return joined || null;
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'openai responses (document) threw',
    );
    return null;
  }
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return 'tamanho desconhecido';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatSeconds(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m${secs.toString().padStart(2, '0')}s`;
}

export async function processMedia(params: {
  instance: string;
  messageId: string;
  messageType: string;
  message?: Record<string, unknown>;
  openaiKey: string;
}): Promise<MediaProcessingResult> {
  const fallbackText = `[${mediaLabel(params.messageType)} enviado pelo usuário, não consegui processar agora]`;

  // AUDIO → Whisper
  if (params.messageType === 'audioMessage') {
    const download = await downloadMediaBase64({
      instance: params.instance,
      messageId: params.messageId,
    });
    if (!download) return { text: fallbackText, transcription: null, mediaUrl: null };

    const transcription = await transcribeAudio({
      openaiKey: params.openaiKey,
      base64: download.base64,
      mimeType: download.mimeType,
    });
    if (!transcription) return { text: fallbackText, transcription: null, mediaUrl: null };

    return {
      text: `[O usuário enviou um áudio]\nTranscrição: ${transcription}`,
      transcription,
      mediaUrl: null,
    };
  }

  // IMAGE → Vision (respeita caption)
  if (params.messageType === 'imageMessage') {
    const imageMsg = params.message?.imageMessage as { caption?: string } | undefined;
    const caption = typeof imageMsg?.caption === 'string' ? imageMsg.caption.trim() : '';

    const download = await downloadMediaBase64({
      instance: params.instance,
      messageId: params.messageId,
    });
    if (!download) {
      if (caption) {
        return {
          text: `[O usuário enviou uma imagem]\nLegenda: ${caption}\n(não consegui ver a imagem)`,
          transcription: caption,
          mediaUrl: null,
        };
      }
      return { text: fallbackText, transcription: null, mediaUrl: null };
    }

    const description = await describeImage({
      openaiKey: params.openaiKey,
      base64: download.base64,
      mimeType: download.mimeType,
    });
    if (!description) {
      if (caption) {
        return {
          text: `[O usuário enviou uma imagem]\nLegenda: ${caption}\n(não consegui descrever o conteúdo visual)`,
          transcription: caption,
          mediaUrl: null,
        };
      }
      return { text: fallbackText, transcription: null, mediaUrl: null };
    }

    const captionSuffix = caption ? `\nLegenda do usuário: ${caption}` : '';
    return {
      text: `[O usuário enviou uma imagem]\nDescrição: ${description}${captionSuffix}`,
      transcription: description,
      mediaUrl: null,
    };
  }

  // STICKER → Vision (webp funciona)
  if (params.messageType === 'stickerMessage') {
    const download = await downloadMediaBase64({
      instance: params.instance,
      messageId: params.messageId,
    });
    if (!download) return { text: fallbackText, transcription: null, mediaUrl: null };

    const description = await describeImage({
      openaiKey: params.openaiKey,
      base64: download.base64,
      mimeType: download.mimeType || 'image/webp',
      prompt: STICKER_PROMPT,
      maxTokens: 80,
    });
    if (!description) return { text: fallbackText, transcription: null, mediaUrl: null };

    return {
      text: `[O usuário enviou uma figurinha]\n${description}`,
      transcription: description,
      mediaUrl: null,
    };
  }

  // VIDEO → fallback com metadata (Gemini removido no template simplificado)
  if (params.messageType === 'videoMessage') {
    const videoMsg = params.message?.videoMessage as
      | { seconds?: number; fileLength?: number | { low?: number }; caption?: string }
      | undefined;
    const caption = typeof videoMsg?.caption === 'string' ? videoMsg.caption : null;
    const seconds = typeof videoMsg?.seconds === 'number' ? videoMsg.seconds : null;
    const bytes =
      typeof videoMsg?.fileLength === 'number'
        ? videoMsg.fileLength
        : (videoMsg?.fileLength as { low?: number } | undefined)?.low ?? null;
    const durationStr = formatSeconds(seconds);
    const sizeStr = formatBytes(bytes);
    const parts = ['[O usuário enviou um vídeo'];
    if (durationStr) parts.push(`duração ${durationStr}`);
    parts.push(sizeStr + ']');
    let text = parts.join(', ').replace(', ]', ']');
    if (caption) text += `\nLegenda: ${caption}`;
    text += '\n(análise de vídeo não está habilitada neste agente; peça pro usuário descrever em texto se for importante)';
    return { text, transcription: caption, mediaUrl: null };
  }

  // DOCUMENT → roteia por mimetype
  if (params.messageType === 'documentMessage') {
    const docMsg = params.message?.documentMessage as
      | {
          mimetype?: string;
          fileName?: string;
          fileLength?: number | { low?: number };
          caption?: string;
          title?: string;
        }
      | undefined;
    const mimetype = docMsg?.mimetype ?? '';
    const fileName = docMsg?.fileName ?? docMsg?.title ?? 'arquivo';
    const bytes =
      typeof docMsg?.fileLength === 'number'
        ? docMsg.fileLength
        : (docMsg?.fileLength as { low?: number } | undefined)?.low ?? null;
    const caption = typeof docMsg?.caption === 'string' ? docMsg.caption : null;
    const captionSuffix = caption ? `\nLegenda: ${caption}` : '';

    if (mimetype.startsWith('image/')) {
      const download = await downloadMediaBase64({
        instance: params.instance,
        messageId: params.messageId,
      });
      if (download) {
        const description = await describeImage({
          openaiKey: params.openaiKey,
          base64: download.base64,
          mimeType: download.mimeType || mimetype,
        });
        if (description) {
          return {
            text: `[O usuário enviou um documento de imagem: ${fileName}]\nDescrição: ${description}${captionSuffix}`,
            transcription: description,
            mediaUrl: null,
          };
        }
      }
    }

    if (mimetype.startsWith('audio/')) {
      const download = await downloadMediaBase64({
        instance: params.instance,
        messageId: params.messageId,
      });
      if (download) {
        const transcription = await transcribeAudio({
          openaiKey: params.openaiKey,
          base64: download.base64,
          mimeType: download.mimeType || mimetype,
        });
        if (transcription) {
          return {
            text: `[O usuário enviou um áudio como arquivo: ${fileName}]\nTranscrição: ${transcription}${captionSuffix}`,
            transcription,
            mediaUrl: null,
          };
        }
      }
    }

    const isOfficeOrPdf =
      !mimetype.startsWith('image/') &&
      !mimetype.startsWith('video/') &&
      !mimetype.startsWith('audio/');

    if (isOfficeOrPdf) {
      const download = await downloadMediaBase64({
        instance: params.instance,
        messageId: params.messageId,
      });
      if (download) {
        const content = await describeDocumentResponses({
          openaiKey: params.openaiKey,
          base64: download.base64,
          mimeType: download.mimeType || mimetype || 'application/octet-stream',
          fileName,
        });
        if (content) {
          return {
            text: `[O usuário enviou um documento: ${fileName}]\nConteúdo:\n${content}${captionSuffix}`,
            transcription: content,
            mediaUrl: null,
          };
        }
      }
    }

    const sizeStr = formatBytes(bytes);
    const typeHint = mimetype || 'tipo desconhecido';
    let text = `[O usuário enviou um documento: ${fileName} (${typeHint}, ${sizeStr})]`;
    if (caption) text += `\nLegenda: ${caption}`;
    text += '\n(não consegui ler o conteúdo agora, peça pro usuário digitar o conteúdo relevante)';
    return { text, transcription: caption, mediaUrl: null };
  }

  return { text: fallbackText, transcription: null, mediaUrl: null };
}

export function mediaLabel(messageType: string): string {
  switch (messageType) {
    case 'audioMessage':
      return 'áudio';
    case 'imageMessage':
      return 'imagem';
    case 'videoMessage':
      return 'vídeo';
    case 'documentMessage':
      return 'documento';
    case 'stickerMessage':
      return 'figurinha';
    default:
      return 'arquivo';
  }
}

export function isProcessableMedia(messageType: string): boolean {
  return PROCESSABLE_MEDIA.has(messageType);
}
