import { SEGMENT_SAMPLE_RATE, type SlideMark } from './live-recording';
import { encodeWav } from './wav';
import { int16ToFloat, type RecordingVault, type VaultMeta, type VaultSegment } from './recording-vault';

export type RecoveryDeps = {
  /** Indexes the server already has text for (a response lost in the crash). */
  transcribed?: (meta: VaultMeta) => Promise<Set<number>>;
  /** Uploads one WAV segment to the recording's storage folder. */
  upload: (meta: VaultMeta, segment: VaultSegment) => Promise<boolean>;
  /** Asks the server to transcribe an uploaded segment. */
  transcribe: (meta: VaultMeta, segment: VaultSegment) => Promise<boolean>;
  /** Marks the recording stopped with its real length and slide timeline. */
  finalize: (meta: VaultMeta, body: { durationSeconds: number; slideMarks: SlideMark[]; status: 'stopped' }) => Promise<boolean>;
};

export type RecoveryResult = { sent: number; failed: number; durationSeconds: number; finalized: boolean };

// Finishes a recording whose tab died: uploads the segments that never left
// the device, turns the unsent tail into one more segment, transcribes them,
// and closes the recording with its real length. Segments that fail stay in
// the vault, so recovery can be tried again; the download copy is kept until
// the teacher dismisses it.
export async function recoverRecording(vault: RecordingVault, meta: VaultMeta, deps: RecoveryDeps): Promise<RecoveryResult> {
  const pending = await vault.listSegments(meta.recordingId);
  const tail = await vault.readTail(meta.recordingId);
  const tailSeconds = tail.length / SEGMENT_SAMPLE_RATE;
  if (tailSeconds >= 1 && !pending.some((segment) => segment.idx === meta.nextIdx)) {
    const segment: VaultSegment = {
      idx: meta.nextIdx,
      startSeconds: meta.tailStartSeconds,
      durationSeconds: Math.round(tailSeconds),
      blob: encodeWav(int16ToFloat(tail), SEGMENT_SAMPLE_RATE),
    };
    // Saved as a segment first, so a second crash mid-recovery keeps it.
    await vault.putSegment(meta.recordingId, segment);
    await vault.clearTail(meta.recordingId);
    pending.push(segment);
  }
  let sent = 0;
  let failed = 0;
  const done = await deps.transcribed?.(meta).catch(() => new Set<number>()) ?? new Set<number>();
  for (const segment of pending.sort((a, b) => a.idx - b.idx)) {
    // Already transcribed: uploading it again would only put audio back in
    // Storage.
    if (done.has(segment.idx)) {
      await vault.deleteSegment(meta.recordingId, segment.idx);
      sent++;
      continue;
    }
    const ok = (await deps.upload(meta, segment).catch(() => false)) && (await deps.transcribe(meta, segment).catch(() => false));
    if (ok) {
      await vault.deleteSegment(meta.recordingId, segment.idx);
      sent++;
    } else {
      failed++;
    }
  }
  const lastEnd = pending.reduce((end, segment) => Math.max(end, segment.startSeconds + segment.durationSeconds), 0);
  const durationSeconds = Math.round(Math.max(meta.elapsedSeconds, meta.tailStartSeconds + tailSeconds, lastEnd));
  // Closed only once the server confirms; otherwise it stays recoverable.
  const finalized = failed === 0
    && await deps.finalize(meta, { durationSeconds, slideMarks: meta.marks, status: 'stopped' }).catch(() => false);
  if (finalized) await vault.putMeta({ ...meta, elapsedSeconds: durationSeconds, finished: true });
  return { sent, failed, durationSeconds, finalized };
}
