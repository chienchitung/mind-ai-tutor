import type { SupabaseClient } from '@supabase/supabase-js';

export const LIVE_DECK_BUCKET = 'live-decks';
const MAX_DECK_BYTES = 20 * 1024 * 1024;

export function validateDeckFile(file: File): void {
  if (file.type !== 'application/pdf') throw new Error('DECK_TYPE');
  if (file.size > MAX_DECK_BYTES) throw new Error('DECK_SIZE');
}

// Uploads under the authenticated owner's folder (required by the bucket's
// RLS policies, which scope insert/select/delete to storage.foldername(name)[1]
// === auth.uid()), then returns the public URL to persist on the session.
export async function uploadLiveDeck(client: Pick<SupabaseClient, 'storage'>, userId: string, file: File): Promise<string> {
  if (!userId) throw new Error('DECK_AUTH');
  validateDeckFile(file);
  const bucket = client.storage.from(LIVE_DECK_BUCKET);
  const path = `${userId}/${crypto.randomUUID()}.pdf`;
  const { error } = await bucket.upload(path, file, { contentType: 'application/pdf', cacheControl: '3600', upsert: false })
    .catch(() => { throw new Error('DECK_UPLOAD'); });
  if (error) {
    if (/bucket.*not found/i.test(error.message)) throw new Error('DECK_STORAGE_NOT_READY');
    throw new Error('DECK_UPLOAD');
  }
  const { data } = bucket.getPublicUrl(path);
  return data.publicUrl;
}
