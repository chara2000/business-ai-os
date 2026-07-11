import { createAdminClient } from '@/lib/supabase/server';
import { runActionEngine } from '@/lib/ai/engine/pipeline';
import { aiTranscribeAudio } from '@/lib/ai/provider';

export async function askBusinessAI(
  message: string,
  empresaId: string,
  usuarioId?: string | null,
  options?: { maxTokens?: number; forTelegram?: boolean },
) {
  const admin = await createAdminClient();
  const result = await runActionEngine({
    supabase: admin,
    empresaId,
    usuarioId: usuarioId || '',
    message,
    channel: options?.forTelegram ? 'telegram' : 'web',
  });
  return result.texto;
}

export async function transcribeAudioBuffer(buffer: ArrayBuffer, filename = 'audio.ogg', contextPrompt?: string) {
  return aiTranscribeAudio(buffer, filename, contextPrompt);
}

export async function downloadTelegramFile(fileId: string): Promise<ArrayBuffer> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const fileJson = await fileRes.json();
  const path = fileJson.result?.file_path;
  if (!path) throw new Error('No se pudo obtener el archivo de Telegram');
  const audioRes = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
  return audioRes.arrayBuffer();
}
