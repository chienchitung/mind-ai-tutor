import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deckObjectName, deckPathFromUrl, deckTitleFromObjectName, deleteLiveDeck, listLiveDecks, uploadLiveDeck, validateDeckFile } from './live-deck-storage';

function setup() {
  const bucket = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://storage.example/live-decks/${path}` } })),
  };
  const from = vi.fn().mockReturnValue(bucket);
  const client = { storage: { from } } as unknown as Pick<SupabaseClient, 'storage'>;
  const file = new File(['%PDF-1.4'], 'deck.pdf', { type: 'application/pdf' });
  return { bucket, client, file, from };
}

describe('validateDeckFile', () => {
  it('rejects a non-PDF file', () => {
    expect(() => validateDeckFile(new File(['x'], 'deck.pptx', { type: 'application/vnd.ms-powerpoint' }))).toThrow('DECK_TYPE');
  });
  it('rejects a file over 20MB', () => {
    const big = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'deck.pdf', { type: 'application/pdf' });
    expect(() => validateDeckFile(big)).toThrow('DECK_SIZE');
  });
  it('accepts a valid PDF within the size limit', () => {
    expect(() => validateDeckFile(new File(['%PDF-1.4'], 'deck.pdf', { type: 'application/pdf' }))).not.toThrow();
  });
});

describe('uploadLiveDeck', () => {
  it('uploads under the authenticated owner with a unique key, then returns its public URL', async () => {
    const { client, bucket, file, from } = setup();
    const url = await uploadLiveDeck(client, 'owner', file);
    expect(from).toHaveBeenCalledWith('live-decks');
    const path = bucket.upload.mock.calls[0][0];
    expect(path).toMatch(/^owner\/[a-f0-9-]{36}\.[A-Za-z0-9_-]+\.pdf$/);
    expect(deckTitleFromObjectName(path.split('/')[1])).toBe('deck');
    expect(bucket.upload).toHaveBeenCalledWith(path, file, expect.objectContaining({ upsert: false, contentType: 'application/pdf' }));
    expect(url).toBe(`https://storage.example/live-decks/${path}`);
  });
  it('rejects missing ownership or an invalid file before upload', async () => {
    const { client, bucket, file } = setup();
    await expect(uploadLiveDeck(client, '', file)).rejects.toThrow('DECK_AUTH');
    await expect(uploadLiveDeck(client, 'owner', new File(['x'], 'deck.png', { type: 'image/png' }))).rejects.toThrow('DECK_TYPE');
    expect(bucket.upload).not.toHaveBeenCalled();
  });
  it.each([['Bucket not found', 'DECK_STORAGE_NOT_READY'], ['new row violates row-level security policy', 'DECK_UPLOAD']])('handles upload failure: %s', async (message, code) => {
    const { client, bucket, file } = setup();
    bucket.upload.mockResolvedValue({ error: { message } });
    await expect(uploadLiveDeck(client, 'owner', file)).rejects.toThrow(code);
  });
});

describe('deckPathFromUrl', () => {
  it('recovers the storage path from a public URL this module generated', () => {
    expect(deckPathFromUrl('https://storage.example/live-decks/owner/abc-123.pdf')).toBe('owner/abc-123.pdf');
  });
  it('returns null for a URL that never touched this bucket', () => {
    expect(deckPathFromUrl('https://storage.example/some-other-bucket/owner/abc-123.pdf')).toBeNull();
  });
});

describe('deleteLiveDeck', () => {
  it('removes the object this URL points to', async () => {
    const { client, bucket, from } = setup();
    await deleteLiveDeck(client, 'https://storage.example/live-decks/owner/abc-123.pdf');
    expect(from).toHaveBeenCalledWith('live-decks');
    expect(bucket.remove).toHaveBeenCalledWith(['owner/abc-123.pdf']);
  });
  it('is a no-op for a URL it cannot map back to a path', async () => {
    const { client, bucket } = setup();
    await deleteLiveDeck(client, 'https://storage.example/some-other-bucket/owner/abc-123.pdf');
    expect(bucket.remove).not.toHaveBeenCalled();
  });
  it('throws when Storage refuses the delete', async () => {
    const { client, bucket } = setup();
    bucket.remove.mockResolvedValue({ error: { message: 'denied' } });
    await expect(deleteLiveDeck(client, 'https://storage.example/live-decks/owner/abc-123.pdf')).rejects.toThrow('DECK_DELETE');
  });
});

describe('deck titles in object names', () => {
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  it('round-trips a Chinese file name through an ASCII-only key', () => {
    const name = deckObjectName(id, '第三課：IF 條件判斷.pdf');
    expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(deckTitleFromObjectName(name)).toBe('第三課：IF 條件判斷');
  });
  it('treats older uuid-only keys as untitled', () => {
    expect(deckObjectName(id, '.pdf')).toBe(`${id}.pdf`);
    expect(deckTitleFromObjectName(`${id}.pdf`)).toBeNull();
  });
  it('caps very long titles', () => {
    expect(deckTitleFromObjectName(deckObjectName(id, `${'簡'.repeat(200)}.pdf`))).toHaveLength(80);
  });
});

describe('listLiveDecks', () => {
  it("lists the owner's PDFs newest first with titles, sizes and public URLs", async () => {
    const { client, bucket } = setup();
    const named = deckObjectName('0f8fad5b-d9cb-469f-a165-70867728950e', '函數複習.pdf');
    bucket.list.mockResolvedValue({ data: [
      { id: '1', name: named, created_at: '2026-10-01T00:00:00Z', metadata: { size: 2048 } },
      { id: '2', name: '7c9e6679-7425-40de-944b-e07fc1f90ae7.pdf', created_at: '2026-08-31T00:00:00Z', metadata: { size: 10 } },
      { id: null, name: 'folder', created_at: null, metadata: null },
    ], error: null });
    const decks = await listLiveDecks(client, 'owner');
    expect(bucket.list).toHaveBeenCalledWith('owner', expect.objectContaining({ sortBy: { column: 'created_at', order: 'desc' } }));
    expect(decks).toEqual([
      { path: `owner/${named}`, url: `https://storage.example/live-decks/owner/${named}`, title: '函數複習', size: 2048, createdAt: '2026-10-01T00:00:00Z' },
      { path: 'owner/7c9e6679-7425-40de-944b-e07fc1f90ae7.pdf', url: 'https://storage.example/live-decks/owner/7c9e6679-7425-40de-944b-e07fc1f90ae7.pdf', title: null, size: 10, createdAt: '2026-08-31T00:00:00Z' },
    ]);
  });
  it('maps a missing bucket to the not-ready error', async () => {
    const { client, bucket } = setup();
    bucket.list.mockResolvedValue({ data: null, error: { message: 'Bucket not found' } });
    await expect(listLiveDecks(client, 'owner')).rejects.toThrow('DECK_STORAGE_NOT_READY');
  });
});
