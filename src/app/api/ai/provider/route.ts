import { NextResponse } from 'next/server';
import { getActiveProviderLabel, resolveAIProvider } from '@/lib/ai/provider';

export async function GET() {
  const provider = resolveAIProvider();
  return NextResponse.json({
    success: true,
    provider,
    label: getActiveProviderLabel(),
    configured: provider === 'gemini'
      ? !!process.env.GEMINI_API_KEY
      : !!process.env.OPENAI_API_KEY,
  });
}
