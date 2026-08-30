import { NextResponse } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { coverRequestSchema } from '@/lib/ai-game-cover';
import { generateCoverBackground } from '@/lib/ai-game-cover-server';

export const runtime = 'nodejs';
// Capped at 60 - Vercel's Hobby plan rejects any Serverless Function
// maxDuration above 60 seconds outright, failing the whole deployment.
export const maxDuration = 60;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return fail('FORBIDDEN', 403);
    const client = await getServerClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return fail('UNAUTHORIZED', 401);
    if (process.env.AI_GAME_COVERS_ENABLED !== 'true' || !process.env.GEMINI_API_KEY) return fail('AI_NOT_CONFIGURED', 503);
    const profile = await client.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
    if (profile.error) return fail('ACCESS_NOT_READY', 503);
    if (!['teacher', 'admin'].includes(profile.data?.role || '')) return fail('FORBIDDEN', 403);
    // Stream with a hard cap; no photo, URLs or full lesson attachments accepted.
    const reader = request.body?.getReader();
    if (!reader) return fail('INVALID_INPUT', 400);
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 20000) { await reader.cancel(); return fail('PAYLOAD_TOO_LARGE', 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let json: unknown;
    try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return fail('INVALID_INPUT', 400); }
    const parsed = coverRequestSchema.safeParse(json);
    if (!parsed.success) return fail('INVALID_INPUT', 400);
    // Atomic database quota works across Vercel instances; never fail open.
    const quota = await client.rpc('claim_game_cover_generation', { p_request_id: parsed.data.requestId });
    if (quota.error) return fail('QUOTA_NOT_CONFIGURED', 503);
    if (quota.data !== 'OK') {
      const code = ['DAILY_LIMIT', 'COOLDOWN', 'DUPLICATE'].includes(quota.data) ? quota.data : 'QUOTA_NOT_CONFIGURED';
      return fail(code, code === 'DUPLICATE' ? 409 : code === 'QUOTA_NOT_CONFIGURED' ? 503 : 429);
    }
    const image = await generateCoverBackground(parsed.data);
    return NextResponse.json(image, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (cause) {
    return fail(cause instanceof Error && cause.message === 'NO_IMAGE' ? 'NO_IMAGE' : 'AI_FAILED', 502);
  }
}
