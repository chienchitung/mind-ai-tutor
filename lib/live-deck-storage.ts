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
  const path = `${userId}/${deckObjectName(crypto.randomUUID(), file.name)}`;
  const { error } = await bucket.upload(path, file, { contentType: 'application/pdf', cacheControl: '3600', upsert: false })
    .catch(() => { throw new Error('DECK_UPLOAD'); });
  if (error) {
    if (/bucket.*not found/i.test(error.message)) throw new Error('DECK_STORAGE_NOT_READY');
    throw new Error('DECK_UPLOAD');
  }
  const { data } = bucket.getPublicUrl(path);
  return data.publicUrl;
}

// Storage keys only accept ASCII, so the original (often Chinese) file name
// rides along base64url-encoded: `<uuid>.<name>.pdf`. That keeps the 簡報庫
// listing a single Storage call with no extra table. Older uploads are
// `<uuid>.pdf` and simply have no title.
const MAX_TITLE_CHARS = 80;
const NAMED_OBJECT = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]+)\.pdf$/i;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string | null {
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function deckTitleFromFileName(fileName: string): string {
  return Array.from(fileName.replace(/\.pdf$/i, '').trim()).slice(0, MAX_TITLE_CHARS).join('');
}

export function deckObjectName(id: string, fileName: string): string {
  const title = deckTitleFromFileName(fileName);
  return title ? `${id}.${toBase64Url(title)}.pdf` : `${id}.pdf`;
}

/** The original file name encoded into an object key, or null for an older upload. */
export function deckTitleFromObjectName(name: string): string | null {
  const match = NAMED_OBJECT.exec(name);
  return match ? fromBase64Url(match[2]) : null;
}

export type LiveDeck = { path: string; url: string; title: string | null; size: number | null; createdAt: string | null };

// The owner's saved decks, newest first. The bucket's select policy is scoped
// to the owner's own folder, so this lists exactly what this teacher uploaded.
export async function listLiveDecks(client: Pick<SupabaseClient, 'storage'>, userId: string): Promise<LiveDeck[]> {
  if (!userId) throw new Error('DECK_AUTH');
  const bucket = client.storage.from(LIVE_DECK_BUCKET);
  const { data, error } = await bucket.list(userId, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) {
    if (/bucket.*not found/i.test(error.message)) throw new Error('DECK_STORAGE_NOT_READY');
    throw new Error('DECK_LIST');
  }
  return (data ?? [])
    .filter((item) => item.id && item.name.toLowerCase().endsWith('.pdf'))
    .map((item) => {
      const path = `${userId}/${item.name}`;
      const size = Number((item.metadata as { size?: unknown } | null)?.size);
      return {
        path,
        url: bucket.getPublicUrl(path).data.publicUrl,
        title: deckTitleFromObjectName(item.name),
        size: Number.isFinite(size) ? size : null,
        createdAt: item.created_at ?? null,
      };
    });
}

/** Recovers the storage path this module generated a public URL for. */
export function deckPathFromUrl(url: string): string | null {
  const marker = `/${LIVE_DECK_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

// Removes a deck from the owner's library. Sessions no longer delete their
// deck on replace/clear/delete - the same PDF is meant to be reused - so this
// only runs when the teacher deletes it from the 簡報庫 (or rolls back an
// upload whose session update failed). Throws so the caller decides how to
// surface a failure.
export async function deleteLiveDeck(client: Pick<SupabaseClient, 'storage'>, deckUrl: string): Promise<void> {
  const path = deckPathFromUrl(deckUrl);
  if (!path) return;
  const { error } = await client.storage.from(LIVE_DECK_BUCKET).remove([path]);
  if (error) throw new Error('DECK_DELETE');
}
