import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClient } from '@/app/lib/supabase';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const answerSchema = z.union([z.string().max(10000), z.array(z.string().max(100)).max(20)]);
const attemptSchema = z.object({
  studentName: z.string().trim().min(1).max(100),
  answers: z.record(z.string().max(100), answerSchema).refine(value => Object.keys(value).length <= 100, 'Too many answers'),
});

// Intentionally unauthenticated: students take a shared quiz without an
// account. submit_public_quiz_attempt() re-derives the score server-side
// from the real answer key - the client's own claimed score is never
// trusted - and only accepts submissions for quizzes marked is_public.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_QUIZ' }, { status: 400 });
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 200000) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    let json: unknown;
    try { json = JSON.parse(text); } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); }
    const parsed = attemptSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const client = await getServerClient();
    const { data, error } = await client.rpc('submit_public_quiz_attempt', {
      p_quiz_id: id, p_student_name: parsed.data.studentName, p_answers: parsed.data.answers,
    });
    if (error) {
      const notFound = error.message?.includes('QUIZ_NOT_FOUND');
      return NextResponse.json({ error: notFound ? 'NOT_FOUND' : 'QUIZ_STORAGE_ERROR' }, { status: notFound ? 404 : 500 });
    }
    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'QUIZ_STORAGE_ERROR' }, { status: 500 });
  }
}
