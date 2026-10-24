import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { getServerClient } from '@/lib/supabase-server';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';
import { LIVE_DECK_BUCKET } from '@/lib/live-deck-storage';

const deleteSchema = z.object({ path: z.string().trim().min(1).max(1024) });

// Deletes one PDF from the teacher's 簡報庫 and detaches it from every one of
// their sessions still pointing at it, so none of them is left showing a
// broken deck. Storage RLS already limits removal to the owner's folder; the
// prefix check here just turns a foreign path into a clean 403.
export async function DELETE(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    let json: unknown;
    try { json = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); }
    const parsed = deleteSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { path } = parsed.data;
    if (!path.startsWith(`${user.id}/`) || path.includes('..')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const bucket = client.storage.from(LIVE_DECK_BUCKET);
    const url = bucket.getPublicUrl(path).data.publicUrl;
    const { data: detached, error: detachError } = await client.from('live_sessions')
      .update({ deck_url: null, deck_page: 1, updated_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('deck_url', url)
      .select('id');
    if (detachError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    const { error: removeError } = await bucket.remove([path]);
    if (removeError) return NextResponse.json({ error: 'DECK_DELETE' }, { status: 500 });

    for (const { id } of detached ?? []) {
      after(() => broadcastLiveUpdate(id, 'deck:sync', { page: 1, deckUrl: null })
        .catch((cause) => console.error('live deck detach broadcast failed:', cause)));
    }
    return NextResponse.json({ detachedSessionIds: (detached ?? []).map(({ id }) => id) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}
