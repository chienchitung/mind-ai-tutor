import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GameCoverSaveRejected, saveWithGameCover } from './game-cover-storage';

function setup() {
  const bucket = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://storage.example/game-covers/${path}` } })),
    remove: vi.fn().mockResolvedValue({ error: null }),
  };
  const from = vi.fn().mockReturnValue(bucket);
  const client = { storage: { from } } as unknown as Pick<SupabaseClient, 'storage'>;
  const file = new File(['image'], 'cover.jpg', { type: 'image/jpeg' });
  return { bucket, client, file, from };
}

describe('deferred game cover uploads', () => {
  it('preserves existing external URLs and does not touch storage without a new file', async () => {
    const { client, from } = setup();
    const save = vi.fn().mockResolvedValue('saved');
    await expect(saveWithGameCover(client, 'owner', null, 'https://old.example/image.png', save)).resolves.toBe('saved');
    expect(from).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith('https://old.example/image.png');
  });
  it('uploads under the authenticated owner with a unique key, then saves its public URL', async () => {
    const { client, bucket, file, from } = setup();
    const save = vi.fn().mockResolvedValue({ id: 'game' });
    await saveWithGameCover(client, 'owner', file, 'old-url', save);
    expect(from).toHaveBeenCalledWith('game-covers');
    const path = bucket.upload.mock.calls[0][0];
    expect(path).toMatch(/^owner\/[a-f0-9-]{36}\.jpg$/);
    expect(bucket.upload).toHaveBeenCalledWith(path, file, expect.objectContaining({ upsert: false, contentType: 'image/jpeg' }));
    expect(save).toHaveBeenCalledWith(`https://storage.example/game-covers/${path}`);
    expect(bucket.remove).not.toHaveBeenCalled();
  });
  it('cleans up only the newly uploaded image after a confirmed save rejection', async () => {
    const { client, bucket, file } = setup();
    const save = vi.fn().mockRejectedValue(new GameCoverSaveRejected('RLS'));
    await expect(saveWithGameCover(client, 'owner', file, 'old-url', save)).rejects.toThrow('RLS');
    expect(bucket.remove).toHaveBeenCalledWith([bucket.upload.mock.calls[0][0]]);
  });
  it('does not delete a possibly committed cover after a network failure', async () => {
    const { client, bucket, file } = setup();
    await expect(saveWithGameCover(client, 'owner', file, 'old-url', async () => { throw new Error('Network'); })).rejects.toThrow('Network');
    expect(bucket.remove).not.toHaveBeenCalled();
  });
  it('does not mask save failures when cleanup also fails', async () => {
    const { client, bucket, file } = setup();
    bucket.remove.mockRejectedValue(new Error('offline'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(saveWithGameCover(client, 'owner', file, '', async () => { throw new GameCoverSaveRejected('Rejected'); })).rejects.toThrow('Rejected');
      expect(warn).toHaveBeenCalled();
    } finally { warn.mockRestore(); }
  });
  it.each([['Bucket not found', 'COVER_STORAGE_NOT_READY'], ['new row violates row-level security policy', 'COVER_UPLOAD']])('handles upload failure: %s', async (message, code) => {
    const { client, bucket, file } = setup();
    bucket.upload.mockResolvedValue({ error: { message } });
    const save = vi.fn();
    await expect(saveWithGameCover(client, 'owner', file, '', save)).rejects.toThrow(code);
    expect(save).not.toHaveBeenCalled();
    expect(bucket.remove).not.toHaveBeenCalled();
  });
  it('rejects missing ownership or unprocessed files before upload', async () => {
    const { client, bucket, file } = setup();
    await expect(saveWithGameCover(client, '', file, '', vi.fn())).rejects.toThrow('COVER_AUTH');
    await expect(saveWithGameCover(client, 'owner', new File(['png'], 'file.png', { type: 'image/png' }), '', vi.fn())).rejects.toThrow('COVER_TYPE');
    expect(bucket.upload).not.toHaveBeenCalled();
  });
});
