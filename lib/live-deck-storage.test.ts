import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deckPathFromUrl, deleteLiveDeck, uploadLiveDeck, validateDeckFile } from './live-deck-storage';

function setup() {
  const bucket = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
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
    expect(path).toMatch(/^owner\/[a-f0-9-]{36}\.pdf$/);
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
