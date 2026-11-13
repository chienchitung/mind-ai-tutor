import { NextResponse, after } from 'next/server';
import { getServerClient } from '@/lib/supabase-server';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const scopes = { questions: [true, false], pulse: [false, true], all: [true, true] } as const;

// Teacher-only: wipe the session's Q&A and/or difficulty feedback, keeping
// the session itself. ?scope=questions|pulse|all.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 400 });
    const scope = new URL(request.url).searchParams.get('scope');
    if (scope !== 'questions' && scope !== 'pulse' && scope !== 'all') return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const [questions, pulse] = scopes[scope];

    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { error } = await client.rpc('clear_live_session_activity', { p_session_id: id, p_questions: questions, p_pulse: pulse });
    if (error) {
      const status = error.message?.includes('FORBIDDEN') ? 404 : 500;
      return NextResponse.json({ error: status === 404 ? 'NOT_FOUND' : 'LIVE_STORAGE_ERROR' }, { status });
    }

    // See app/api/live-sessions/[id]/route.ts - broadcast never gates the response.
    after(() => Promise.all([
      broadcastLiveUpdate(id, 'activity:cleared', { questions, pulse }),
      ...(questions ? [broadcastLiveUpdate(id, 'presentation:changed', {})] : []),
    ]).catch((cause) => console.error('live activity clear broadcast failed:', cause)));

    return NextResponse.json({ questions, pulse }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}
