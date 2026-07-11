import OpenAI from 'openai';
import { GoogleGenerativeAI, type Content } from '@google/generative-ai';

export type AIProviderName = 'gemini' | 'openai';

export type ToolCall = {
  id: string;
  name: string;
  arguments: string; // JSON string representation
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export type AITool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
};

export type ChatCompletionResult = {
  text: string;
  provider: AIProviderName;
  model: string;
  toolCalls?: ToolCall[];
  usage?: unknown;
};

const DEFAULT_PROVIDER = process.env.AI_PROVIDER || 'openai';
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o';
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

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
    const turnText = turn.parts[0]?.text ?? '';
    const prev = merged[merged.length - 1];
    if (prev && prev.role === turn.role) {
      const prevPart = prev.parts[0];
      if (prevPart && 'text' in prevPart) {
        prevPart.text = `${prevPart.text ?? ''}\n\n${turnText}`;
      }
    } else {
      merged.push({ role: turn.role, parts: [{ text: turnText }] });
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
  tools?: AITool[];
}): Promise<ChatCompletionResult> {
  const provider = resolveAIProvider();
  assertProviderReady(provider);

  if (provider === 'openai') {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: DEFAULT_OPENAI_MODEL,
      messages: [
        { role: 'system', content: params.systemPrompt },
        ...params.messages.filter((m) => m.role !== 'system').map((m) => {
          if (m.role === 'tool') return { role: 'tool' as const, content: m.content, tool_call_id: m.tool_call_id! };
          if (m.role === 'assistant' && m.tool_calls) {
            return { role: 'assistant' as const, content: m.content || null, tool_calls: m.tool_calls.map(t => ({ id: t.id, type: 'function' as const, function: { name: t.name, arguments: t.arguments } })) };
          }
          return { role: m.role as 'user' | 'assistant', content: m.content };
        }),
      ],
      tools: params.tools?.length ? params.tools : undefined,
      max_tokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0.7,
    });

    const msg = completion.choices[0]?.message;
    const toolCalls = msg?.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));

    return {
      text: msg?.content ?? '',
      provider,
      model: DEFAULT_OPENAI_MODEL,
      toolCalls,
      usage: completion.usage,
    };
  }

  const genAI = getGemini();
  const toolsParam = params.tools?.length
    ? [{ functionDeclarations: params.tools.map(t => ({ name: t.function.name, description: t.function.description, parameters: t.function.parameters as any })) }]
    : undefined;

  const model = genAI.getGenerativeModel({
    model: DEFAULT_GEMINI_MODEL,
    systemInstruction: params.systemPrompt,
    tools: toolsParam,
    generationConfig: {
      maxOutputTokens: params.maxTokens ?? 1024,
      temperature: params.temperature ?? 0.7,
    },
  });

  const { history, userText } = buildGeminiHistory(params.messages);
  if (!userText && history.length === 0) {
    throw new Error('Se requiere al menos un mensaje de usuario o historial');
  }

  let text = '';
  let toolCalls: ToolCall[] | undefined;
  let usage: unknown;

  if (history.length === 0) {
    const result = await model.generateContent(userText);
    text = result.response.text() || '';
    usage = result.response.usageMetadata;
    const calls = result.response.functionCalls();
    if (calls && calls.length > 0) {
      toolCalls = calls.map((c, i) => ({ id: `call_${i}`, name: c.name, arguments: JSON.stringify(c.args) }));
    }
  } else {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(userText || [{ text: '' }]);
    text = result.response.text() || '';
    usage = result.response.usageMetadata;
    const calls = result.response.functionCalls();
    if (calls && calls.length > 0) {
      toolCalls = calls.map((c, i) => ({ id: `call_${i}`, name: c.name, arguments: JSON.stringify(c.args) }));
    }
  }

  return {
    text,
    provider,
    model: DEFAULT_GEMINI_MODEL,
    toolCalls,
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

export async function aiTranscribeAudio(
  buffer: ArrayBuffer, 
  filename = 'audio.ogg',
  contextPrompt?: string
): Promise<string> {
  const provider = resolveAIProvider();
  assertProviderReady(provider);

  const mimeType = mimeFromFilename(filename);
  const transcribeWithOpenAI = async () => {
    const openai = getOpenAI();
    const file = new File([buffer], filename, { type: mimeType });
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'es',
      // Inyectamos el contexto del negocio para mejorar drásticamente la transcripción
      ...(contextPrompt ? { prompt: contextPrompt } : {}),
    });
    return result.text?.trim() ?? '';
  };

  if (provider === 'openai') {
    return transcribeWithOpenAI();
  }

  try {
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

    const text = result.response.text().trim();
    if (text) return text;
  } catch (error) {
    console.error('[AI audio Gemini]', error);
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await transcribeWithOpenAI();
    } catch (error) {
      console.error('[AI audio OpenAI fallback]', error);
    }
  }

  throw new Error('No se pudo transcribir el audio');
}

export async function aiGetEmbedding(text: string): Promise<number[] | null> {
  const provider = resolveAIProvider();
  if (provider !== 'openai') return null;
  assertProviderReady(provider);
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('[AI] Error generando embedding:', err);
    return null;
  }
}
