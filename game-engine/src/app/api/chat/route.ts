import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getChatResponse, type ChatContext } from '@/lib/gemini-server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BODY_BYTES = 3_000_000;
const MAX_IMAGE_CHARS = 2_800_000;
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 12;
const rateWindows = new Map<string, { startedAt: number; count: number }>();
const fail = (error: string, status: number) => NextResponse.json(
  { error },
  { status, headers: { 'Cache-Control': 'private, no-store' } },
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const configured = (process.env.GAME_ALLOWED_ORIGINS || 'https://www.mindaitutor.com,https://mindaitutor.com')
    .split(',').map(value => value.trim()).filter(Boolean);
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const origins = [new URL(request.url).origin, ...configured];
  if (forwardedHost) origins.push(`${request.headers.get('x-forwarded-proto') || 'https'}://${forwardedHost}`);
  return origins.includes(origin);
}

function withinRateLimit(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const key = createHash('sha256')
    .update(`${forwarded || 'unknown'}|${request.headers.get('user-agent') || 'unknown'}`)
    .digest('hex');
  const now = Date.now();
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    if (rateWindows.size > 5_000) {
      rateWindows.forEach((window, candidate) => {
        if (now - window.startedAt >= WINDOW_MS) rateWindows.delete(candidate);
      });
    }
    return true;
  }
  current.count += 1;
  return current.count <= REQUESTS_PER_WINDOW;
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_INPUT');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error('PAYLOAD_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('INVALID_INPUT');
  }
}

function parsePayload(value: unknown): { message: string; image?: string; context?: ChatContext } | null {
  if (!isRecord(value)) return null;
  const message = typeof value.message === 'string' ? value.message.trim() : '';
  if (message.length > 4_000) return null;

  let image: string | undefined;
  if (value.image !== undefined) {
    if (typeof value.image !== 'string' || value.image.length > MAX_IMAGE_CHARS ||
      !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.image)) return null;
    image = value.image;
  }
  if (!message && !image) return null;

  let context: ChatContext | undefined;
  if (value.context !== undefined) {
    if (!isRecord(value.context) || !Array.isArray(value.context.context) || value.context.context.length > 8 ||
      typeof value.context.lessonInfo !== 'string' || value.context.lessonInfo.length > 30_000) return null;
    const history = value.context.context.map(item => {
      if (!isRecord(item) || typeof item.content !== 'string' || item.content.length > 4_000 || typeof item.isUser !== 'boolean') return null;
      return { content: item.content, isUser: item.isUser };
    });
    if (history.some(item => item === null)) return null;
    const gameTitle = value.context.gameTitle;
    const tutorPrompt = value.context.tutorPrompt;
    if ((gameTitle !== undefined && (typeof gameTitle !== 'string' || gameTitle.length > 200)) ||
      (tutorPrompt !== undefined && (typeof tutorPrompt !== 'string' || tutorPrompt.length > 16_000))) return null;
    context = {
      context: history as ChatContext['context'],
      lessonInfo: value.context.lessonInfo,
      ...(typeof gameTitle === 'string' ? { gameTitle } : {}),
      ...(typeof tutorPrompt === 'string' ? { tutorPrompt } : {}),
    };
  }
  return { message, image, context };
}

export async function POST(request: Request) {
  try {
    if (!validOrigin(request)) return fail('FORBIDDEN', 403);
    if (!process.env.GEMINI_API_KEY) return fail('AI_NOT_CONFIGURED', 503);
    if (!withinRateLimit(request)) return fail('RATE_LIMITED', 429);
    const payload = parsePayload(await readBoundedJson(request));
    if (!payload) return fail('INVALID_INPUT', 400);
    const response = await getChatResponse(payload.message, payload.context, payload.image);
    return NextResponse.json({ response }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') return fail('PAYLOAD_TOO_LARGE', 413);
    if (error instanceof Error && error.message === 'INVALID_INPUT') return fail('INVALID_INPUT', 400);
    console.error('Error in /api/chat:', error);
    return fail('AI_FAILED', 502);
  }
}
