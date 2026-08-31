import { NextResponse, after } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { questionModerateSchema } from '@/lib/live-session';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Teacher-only moderation: toggle a question's visibility on their own session.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; qid: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { id, qid } = await params;
    if (!uuid.test(id) || !uuid.test(qid)) return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 400 });
    let json: unknown;
    try { json = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); }
    const parsed = questionModerateSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data, error } = await client.rpc('moderate_live_question', {
      p_question_id: qid,
      p_visibility: parsed.data.visibility,
    });
    if (error) {
      const status = error.message?.includes('FORBIDDEN') ? 404 : 500;
      return NextResponse.json({ error: status === 404 ? 'NOT_FOUND' : 'LIVE_STORAGE_ERROR' }, { status });
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    // See app/api/live-sessions/[id]/route.ts - broadcast never gates the response.
    after(() => broadcastLiveUpdate(id, 'question:moderated', {
      questionId: result.id, visibility: result.visibility,
    }).catch((cause) => console.error('live question moderation broadcast failed:', cause)));

    return NextResponse.json(
      { questionId: result.id, visibility: result.visibility },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}
