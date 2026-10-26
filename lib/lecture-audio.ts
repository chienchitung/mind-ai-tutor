'use client';

import { supabase } from './supabase';
import { RECORDING_BUCKET } from './live-recording';

// The whole lesson's compressed audio, kept in the recording's private
// folder so the transcript can be played back from any computer.
export const lectureAudioPath = (userId: string, recordingId: string) => `${userId}/${recordingId}/lecture-audio`;

/** Uploads (or replaces) a recording's lesson audio. */
export async function uploadLectureAudio(userId: string, recordingId: string, blob: Blob): Promise<boolean> {
  // The bucket allows base types only ("audio/webm", not "...;codecs=opus").
  const contentType = (blob.type || 'audio/webm').split(';')[0];
  const { error } = await supabase().storage.from(RECORDING_BUCKET)
    .upload(lectureAudioPath(userId, recordingId), blob, { contentType, upsert: true })
    .catch(() => ({ error: new Error('UPLOAD') }));
  return !error;
}

/**
 * The recording's lesson audio as a local blob, or null if it was never
 * kept (recordings made before this, or a failed upload). Fetched whole:
 * browser-recorded WebM has no index, so seeking needs all of it at hand.
 */
export async function loadLectureAudio(userId: string, recordingId: string): Promise<Blob | null> {
  const { data, error } = await supabase().storage.from(RECORDING_BUCKET)
    .download(lectureAudioPath(userId, recordingId))
    .catch(() => ({ data: null, error: new Error('DOWNLOAD') }));
  return error || !data || !data.size ? null : data;
}
