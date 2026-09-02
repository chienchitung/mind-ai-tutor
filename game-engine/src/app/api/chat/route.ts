import { NextResponse } from 'next/server';
import { getChatResponse, type ChatContext } from '@/lib/gemini-server';

export const runtime = 'nodejs';
// Keep below Vercel's own default ceiling so a slow Gemini response surfaces
// through getChatResponse's own retry/error handling instead of an opaque
// platform-level timeout mid-request.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message : '';
    const image = typeof body?.image === 'string' ? body.image : undefined;
    const context: ChatContext | undefined = body?.context && typeof body.context === 'object'
      ? body.context
      : undefined;

    if (!message.trim() && !image) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const response = await getChatResponse(message, context, image);
    return NextResponse.json({ response });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    return NextResponse.json(
      { response: '# 系統錯誤\n\n> 抱歉，我現在無法回應。請稍後再試。' },
      { status: 200 },
    );
  }
}
