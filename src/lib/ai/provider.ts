import OpenAI from 'openai';
import { GoogleGenerativeAI, type Content } from '@google/generative-ai';

export type AIProviderName = 'gemini' | 'openai';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatCompletionResult = {
  text: string;
  provider: AIProviderName;
  model: string;
  usage?: unknown;
};

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

export function resolveAIProvider(): AIProviderName {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === 'openai') return 'openai';
  if (explicit === 'gemini') return 'gemini';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'gemini';
}

export function getActiveProviderLabel(): string {
  const p = resolveAIProvider();
  return p === 'gemini'
    ? `Gemini (${DEFAULT_GEMINI_MODEL})`
    : `OpenAI (${DEFAULT_OPENAI_MODEL})`;
}

function assertProviderReady(provider: AIProviderName) {
  if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurada. Obtén una en https://aistudio.google.com/apikey');
  }
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurada');
  }
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getGemini() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
}

/** Gemini exige: historial alternado user/model y que empiece con user */
function buildGeminiHistory(messages: ChatMessage[]): { history: Content[]; userText: string } {
  const filtered = messages.filter((m) => m.role !== 'system');
  let lastUserIndex = -1;
  for (let i = filtered.length - 1; i >= 0; i--) {
    if (filtered[i].role === 'user') {
      lastUserIndex = i;
      break;
    }
  }

  const userText = lastUserIndex >= 0 ? filtered[lastUserIndex].content : '';
  const prior = lastUserIndex >= 0 ? filtered.slice(0, lastUserIndex) : filtered;

  let history: Content[] = prior.map((m) => ({
    role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
    parts: [{ text: m.content }],
  }));

  // Quitar mensajes iniciales del asistente (ej. bienvenida en /ai)
  while (history.length > 0 && history[0].role === 'model') {
    history.shift();
  }

  // Fusionar turnos consecutivos del mismo rol
  const merged: Content[] = [];
  for (const turn of history) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === turn.role) {
      prev.parts[0].text += `\n\n${turn.parts[0].text}`;
    } else {
      merged.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] });
    }
  }

  // Historial debe terminar en 'model' antes del nuevo mensaje user
  if (merged.length > 0 && merged[merged.length - 1].role === 'user') {
    merged.pop();
  }

  return { history: merged, userText };
}

export async function aiChatCompletion(params: {
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<ChatCompletionResult> {
  const provider = resolveAIProvider();
  assertProviderReady(provider);

  if (provider === 'openai') {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: DEFAULT_OPENAI_MODEL,
      messages: [
        { role: 'system', content: params.systemPrompt },
        ...params.messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
      ],
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0.7,
    });

    return {
      text: completion.choices[0]?.message?.content ?? '',
      provider,
      model: DEFAULT_OPENAI_MODEL,
      usage: completion.usage,
    };
  }

  const genAI = getGemini();
  const model = genAI.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    systemInstruction: params.systemPrompt,
    generationConfig: {
      maxOutputTokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0.7,
    },
  });

  const { history, userText } = buildGeminiHistory(params.messages);
  if (!userText) {
    throw new Error('Se requiere al menos un mensaje de usuario');
  }

  let text: string;
  let usage: unknown;

  if (history.length === 0) {
    const result = await model.generateContent(userText);
    text = result.response.text();
    usage = result.response.usageMetadata;
  } else {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(userText);
    text = result.response.text();
    usage = result.response.usageMetadata;
  }

  return {
    text,
    provider,
    model: DEFAULT_GEMINI_MODEL,
    usage,
  };
}

export async function aiJsonCompletion(params: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const provider = resolveAIProvider();
  assertProviderReady(provider);

  if (provider === 'openai') {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: DEFAULT_OPENAI_MODEL,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      max_tokens: params.maxTokens ?? 1500,
      temperature: params.temperature ?? 0.1,
      response_format: { type: 'json_object' },
    });
    return completion.choices[0]?.message?.content ?? '{}';
  }

  const genAI = getGemini();
  const model = genAI.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    systemInstruction: `${params.systemPrompt}\nResponde ÚNICAMENTE con JSON válido, sin markdown.`,
    generationConfig: {
      maxOutputTokens: params.maxTokens ?? 1500,
      temperature: params.temperature ?? 0.1,
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent(params.userPrompt);
  return result.response.text();
}

export async function aiVisionJson(params: {
  systemPrompt: string;
  userPrompt: string;
  imageBase64: string;
  mimeType: string;
}): Promise<string> {
  const provider = resolveAIProvider();
  assertProviderReady(provider);

  if (provider === 'openai') {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: DEFAULT_OPENAI_MODEL,
      messages: [
        { role: 'system', content: params.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: params.userPrompt },
            { type: 'image_url', image_url: { url: `data:${params.mimeType};base64,${params.imageBase64}` } },
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    return completion.choices[0]?.message?.content ?? '{}';
  }

  const genAI = getGemini();
  const model = genAI.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    systemInstruction: `${params.systemPrompt}\nResponde ÚNICAMENTE con JSON válido.`,
    generationConfig: {
      maxOutputTokens: 1500,
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent([
    { text: params.userPrompt },
    { inlineData: { mimeType: params.mimeType, data: params.imageBase64 } },
  ]);

  return result.response.text();
}

function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'webm') return 'audio/webm';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'm4a') return 'audio/mp4';
  return 'audio/ogg';
}

export async function aiTranscribeAudio(buffer: ArrayBuffer, filename = 'audio.ogg'): Promise<string> {
  const provider = resolveAIProvider();
  assertProviderReady(provider);

  if (provider === 'openai') {
    const openai = getOpenAI();
    const file = new File([buffer], filename, { type: mimeFromFilename(filename) });
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'es',
    });
    return result.text?.trim() ?? '';
  }

  const mimeType = mimeFromFilename(filename);
  const base64 = Buffer.from(buffer).toString('base64');
  const genAI = getGemini();
  const model = genAI.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    systemInstruction: 'Transcribe el audio al español. Devuelve SOLO el texto transcrito, sin comentarios.',
  });

  const result = await model.generateContent([
    { text: 'Transcribe este audio en español:' },
    { inlineData: { mimeType, data: base64 } },
  ]);

  return result.response.text().trim();
}
