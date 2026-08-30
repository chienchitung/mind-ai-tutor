import type { SupabaseClient } from '@supabase/supabase-js';
import { validateCoverFile } from './game-cover';

export const GAME_COVER_BUCKET = 'game-covers';

// Call only when saving the game, never when choosing/cropping a file.
// Old URLs are deliberately kept: they may also be used by other games.
export async function saveWithGameCover<T>(
  client: Pick<SupabaseClient, 'storage'>,
  userId: string,
  file: File | null,
  existingUrl: string,
  save: (thumbnailUrl: string) => Promise<T>,
): Promise<T> {
  if (!file) return save(existingUrl);
  if (!userId) throw new Error('COVER_AUTH');
  validateCoverFile(file);
  if (file.type !== 'image/jpeg') throw new Error('COVER_TYPE');
  const bucket = client.storage.from(GAME_COVER_BUCKET);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await bucket.upload(path, file, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
    .catch(() => { throw new Error('COVER_UPLOAD'); });
  if (error) {
    if (/bucket.*not found/i.test(error.message)) throw new Error('COVER_STORAGE_NOT_READY');
    throw new Error('COVER_UPLOAD');
  }
  const { data } = bucket.getPublicUrl(path);
  try {
    return await save(data.publicUrl);
  } catch (saveError) {
    // Only remove the object created by this attempt after a confirmed DB rejection.
    // A transport failure has an uncertain commit outcome, so retain it rather than
    // risk breaking a game that may already have saved successfully.
    if (saveError instanceof GameCoverSaveRejected) {
      try {
        const { error: cleanupError } = await bucket.remove([path]);
        if (cleanupError) console.warn('Unable to remove unused game cover after save rejection.');
      } catch { console.warn('Unable to remove unused game cover after save rejection.'); }
    }
    throw saveError;
  }
}

export class GameCoverSaveRejected extends Error {}
