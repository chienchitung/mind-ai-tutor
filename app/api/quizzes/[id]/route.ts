import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerClient } from '@/app/lib/supabase';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sharePayloadSchema = z.object({ isPublic: z.boolean() });

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_QUIZ' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    // RLS also restricts deletes to the owner; the user_id filter is defense
    // in depth, not the security boundary itself.
    const { error, count } = await client.from('ai_quizzes').delete({ count: 'exact' }).eq('id', id).eq('user_id', user.id);
    if (error) return NextResponse.json({ error: 'QUIZ_STORAGE_ERROR' }, { status: 500 });
    if (!count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'QUIZ_STORAGE_ERROR' }, { status: 500 });
  }
}

// Toggles a quiz's public share link. The link itself is just the quiz id -
// unguessable (a random UUID) and never reveals answers; see
// app/api/public/quizzes/[id]/route.ts for what a public visitor can read.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_QUIZ' }, { status: 400 });
    let json: unknown;
    try { json = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_QUIZ' }, { status: 400 }); }
    const parsed = sharePayloadSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_QUIZ' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { data, error } = await client.from('ai_quizzes')
      .update({ is_public: parsed.data.isPublic })
      .eq('id', id).eq('user_id', user.id)
      .select('id,is_public').maybeSingle();
    if (error) return NextResponse.json({ error: 'QUIZ_STORAGE_ERROR' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'QUIZ_STORAGE_ERROR' }, { status: 500 });
  }
}
