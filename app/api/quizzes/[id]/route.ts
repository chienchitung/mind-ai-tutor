import { NextResponse } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
