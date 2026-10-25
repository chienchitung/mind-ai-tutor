import { describe, expect, it, vi } from 'vitest';
import { floatToInt16, int16ToFloat, memoryVault, type VaultMeta } from './recording-vault';
import { recoverRecording, type RecoveryDeps } from './recording-recovery';

const meta: VaultMeta = {
  recordingId: 'rec-1', userId: 'u-1', sessionId: 's-1', title: '第三課', language: 'zh-TW', startedAt: 0,
  tailStartSeconds: 600, nextIdx: 2, elapsedSeconds: 690, marks: [{ t: 0, page: 1 }, { t: 650, page: 4 }], finished: false,
};
const seconds = (n: number) => floatToInt16(new Float32Array(16_000 * n).fill(0.25));
const deps = (overrides: Partial<RecoveryDeps> = {}): RecoveryDeps => ({
  upload: vi.fn().mockResolvedValue(true),
  transcribe: vi.fn().mockResolvedValue(true),
  finalize: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('recoverRecording', () => {
  it('sends a segment that never uploaded plus the unsent tail, then closes the recording with its real length', async () => {
    const vault = memoryVault();
    await vault.putMeta(meta);
    await vault.putSegment('rec-1', { idx: 1, startSeconds: 300, durationSeconds: 300, blob: new Blob(['wav']) });
    await vault.appendTail('rec-1', seconds(60));
    await vault.appendTail('rec-1', seconds(35));
    await vault.appendMedia('rec-1', new Blob(['opus']));
    const d = deps();

    const result = await recoverRecording(vault, meta, d);

    expect(result).toEqual({ sent: 2, failed: 0, durationSeconds: 695 });
    const transcribed = (d.transcribe as ReturnType<typeof vi.fn>).mock.calls.map(([, segment]) => [segment.idx, segment.startSeconds, segment.durationSeconds]);
    expect(transcribed).toEqual([[1, 300, 300], [2, 600, 95]]);
    expect(d.finalize).toHaveBeenCalledWith(meta, { durationSeconds: 695, slideMarks: meta.marks, status: 'stopped' });
    expect(await vault.listSegments('rec-1')).toEqual([]);
    expect((await vault.readTail('rec-1')).length).toBe(0);
    // The download copy stays until the teacher dismisses it.
    expect(await vault.readMedia('rec-1')).toHaveLength(1);
    expect((await vault.listMeta())[0].finished).toBe(true);
  });

  it('keeps what failed so recovery can be tried again, and does not close the recording yet', async () => {
    const vault = memoryVault();
    await vault.putMeta(meta);
    await vault.appendTail('rec-1', seconds(20));
    const d = deps({ transcribe: vi.fn().mockResolvedValue(false) });

    expect(await recoverRecording(vault, meta, d)).toMatchObject({ sent: 0, failed: 1 });
    expect(d.finalize).not.toHaveBeenCalled();
    // The tail became a saved segment, so a retry does not need the tail.
    expect((await vault.listSegments('rec-1')).map((segment) => segment.idx)).toEqual([2]);

    const retry = deps();
    expect(await recoverRecording(vault, meta, retry)).toMatchObject({ sent: 1, failed: 0 });
    expect(retry.transcribe).toHaveBeenCalledTimes(1);
  });

  it('ignores a tail shorter than a second', async () => {
    const vault = memoryVault();
    await vault.putMeta(meta);
    await vault.appendTail('rec-1', new Int16Array(4_000));
    const d = deps();
    expect(await recoverRecording(vault, meta, d)).toMatchObject({ sent: 0, failed: 0 });
    expect(d.finalize).toHaveBeenCalled();
  });

  it('round-trips samples through 16-bit storage', () => {
    const back = int16ToFloat(floatToInt16(new Float32Array([0, 0.5, -0.5, 1, -1])));
    expect(Array.from(back).map((value) => Math.round(value * 100) / 100)).toEqual([0, 0.5, -0.5, 1, -1]);
  });
});
