// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { memoryVault } from '@/lib/recording-vault';
import { useLectureRecorder } from './useLectureRecorder';

const vaultHolder = vi.hoisted(() => ({ vault: null as unknown }));
vi.mock('@/lib/recording-vault', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/recording-vault')>();
  return { ...actual, openRecordingVault: async () => vaultHolder.vault };
});
const cloud = vi.hoisted(() => ({ uploads: [] as { userId: string; recordingId: string; type: string }[], ok: true }));
vi.mock('@/lib/lecture-audio', () => ({
  uploadLectureAudio: vi.fn(async (userId: string, recordingId: string, blob: Blob) => {
    cloud.uploads.push({ userId, recordingId, type: blob.type });
    return cloud.ok;
  }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: () => ({ storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) } }) }));

class FakeTrack extends EventTarget {
  stopped = false;
  constructor(readonly kind: 'audio' | 'video') { super(); }
  stop() { this.stopped = true; }
}
class FakeStream {
  constructor(readonly tracks: FakeTrack[]) {}
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter((track) => track.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video'); }
}
const recorders: FakeRecorder[] = [];
class FakeRecorder {
  static supported = new Set(['audio/webm;codecs=opus', 'video/webm;codecs=vp9,opus']);
  static isTypeSupported(type: string) { return FakeRecorder.supported.has(type); }
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(readonly stream: FakeStream, readonly options: MediaRecorderOptions) { recorders.push(this); }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['frames'], { type: this.options.mimeType }) });
    this.onstop?.();
  }
}
class FakeAudioContext {
  sampleRate = 16_000;
  destination = {};
  createMediaStreamSource() { return { connect: () => undefined }; }
  createScriptProcessor() { return { connect: () => undefined, disconnect: () => undefined, onaudioprocess: null }; }
  createGain() { return { gain: { value: 1 }, connect: () => undefined }; }
  close() { return Promise.resolve(); }
}

let mic: FakeStream;
let display: FakeStream;
const calls: string[] = [];
const getUserMedia = vi.fn(async () => { calls.push('mic'); return mic; });
const getDisplayMedia = vi.fn(async () => { calls.push('screen'); return display; });
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => (url === '/api/live-recordings' && init?.method === 'POST'
  ? new Response(JSON.stringify({ id: 'rec-1', userId: 'teacher-1' }))
  : new Response('{}')));

beforeEach(() => {
  cloud.uploads = [];
  cloud.ok = true;
  recorders.length = 0;
  calls.length = 0;
  mic = new FakeStream([new FakeTrack('audio')]);
  display = new FakeStream([new FakeTrack('video')]);
  vaultHolder.vault = memoryVault();
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia, getDisplayMedia }, storage: { persist: vi.fn().mockResolvedValue(true) } });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('MediaStream', FakeStream);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => 'blob:download');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const target = { sessionId: 's-1', title: '第三課', language: 'zh-TW' as const };

it('records the screen with the voice when asked, and offers a video download kept on this computer', async () => {
  const { result } = renderHook(() => useLectureRecorder());
  await act(async () => { await result.current.start({ ...target, video: true }); });

  // The picker comes first, while the click still counts as the teacher's.
  expect(calls).toEqual(['screen', 'mic']);
  expect(result.current.phase).toBe('recording');
  expect(result.current.hasVideo).toBe(true);
  const [recorder] = recorders;
  expect(recorder.options.mimeType).toBe('video/webm;codecs=vp9,opus');
  expect(recorder.stream.getTracks()).toEqual([display.tracks[0], mic.tracks[0]]);
  const vault = vaultHolder.vault as ReturnType<typeof memoryVault>;
  expect((await vault.listMeta())[0].hasVideo).toBe(true);

  // Stopping the share from the browser keeps the voice recording.
  act(() => { display.tracks[0].dispatchEvent(new Event('ended')); });
  expect(result.current.screenEnded).toBe(true);
  expect(result.current.phase).toBe('recording');

  await act(async () => { await result.current.stop(); });
  expect(result.current.download?.fileName).toMatch(/^第三課-.*\.webm$/);
  expect(display.tracks[0].stopped).toBe(true);
  expect(mic.tracks[0].stopped).toBe(true);
  // Only audio segments are ever uploaded; the video goes nowhere.
  const uploads = fetchMock.mock.calls.filter(([url]) => String(url).includes('segments'));
  expect(uploads.every(([, init]) => !String(init?.body).includes('video'))).toBe(true);
});

it('does not start when the teacher closes the screen picker', async () => {
  getDisplayMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
  const { result } = renderHook(() => useLectureRecorder());
  await act(async () => { await result.current.start({ ...target, video: true }); });
  expect(result.current.error).toBe('SCREEN_DENIED');
  expect(result.current.phase).toBe('idle');
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('records only the voice by default', async () => {
  const { result } = renderHook(() => useLectureRecorder());
  await act(async () => { await result.current.start(target); });
  expect(getDisplayMedia).not.toHaveBeenCalled();
  expect(result.current.hasVideo).toBe(false);
  expect(recorders[0].options.mimeType).toBe('audio/webm;codecs=opus');
  await act(async () => { await result.current.stop(); });
  expect(result.current.download?.fileName).toMatch(/\.webm$/);
  // Once saved, a later visit does not offer the file again.
  act(() => result.current.markDownloaded());
  const vault = vaultHolder.vault as ReturnType<typeof memoryVault>;
  await vi.waitFor(async () => expect((await vault.listMeta())[0]).toMatchObject({ finished: true, downloaded: true }));
});

it('falls back to voice only where the browser cannot encode video', async () => {
  FakeRecorder.supported.delete('video/webm;codecs=vp9,opus');
  try {
    const { result } = renderHook(() => useLectureRecorder());
    await act(async () => { await result.current.start({ ...target, video: true }); });
    expect(getDisplayMedia).not.toHaveBeenCalled();
    expect(result.current.hasVideo).toBe(false);
    expect(result.current.phase).toBe('recording');
  } finally {
    FakeRecorder.supported.add('video/webm;codecs=vp9,opus');
  }
});

it('keeps offering the last recording when a new start is cancelled at the screen picker', async () => {
  const { result } = renderHook(() => useLectureRecorder());
  await act(async () => { await result.current.start(target); });
  await act(async () => { await result.current.stop(); });
  const download = result.current.download;
  expect(download).not.toBeNull();

  getDisplayMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
  await act(async () => { await result.current.start({ ...target, sessionId: 's-2', video: true }); });
  expect(result.current.error).toBe('SCREEN_DENIED');
  expect(result.current.phase).toBe('stopped');
  expect(result.current.download).toBe(download);
  expect(result.current.target?.sessionId).toBe('s-1');
});

it('keeps the lesson audio in the cloud after a voice-only recording', async () => {
  const { result } = renderHook(() => useLectureRecorder());
  await act(async () => { await result.current.start(target); });
  await act(async () => { await result.current.stop(); });
  await vi.waitFor(() => expect(result.current.cloudAudio).toBe('saved'));
  expect(cloud.uploads).toEqual([{ userId: 'teacher-1', recordingId: 'rec-1', type: 'audio/webm;codecs=opus' }]);
  const vault = vaultHolder.vault as ReturnType<typeof memoryVault>;
  await vi.waitFor(async () => expect((await vault.listMeta())[0].audioSaved).toBe(true));
});

it('sends only the voice to the cloud when the screen is recorded too', async () => {
  const { result } = renderHook(() => useLectureRecorder());
  await act(async () => { await result.current.start({ ...target, video: true }); });
  // One recorder for the video download, one for the voice alone.
  expect(recorders.map((recorder) => recorder.options.mimeType)).toEqual(['video/webm;codecs=vp9,opus', 'audio/webm;codecs=opus']);
  expect(recorders[1].stream).toBe(mic);
  await act(async () => { await result.current.stop(); });
  await vi.waitFor(() => expect(result.current.cloudAudio).toBe('saved'));
  expect(cloud.uploads.map((upload) => upload.type)).toEqual(['audio/webm;codecs=opus']);
  expect(result.current.download?.fileName).toMatch(/\.webm$/);
});

it('offers a retry when the cloud copy fails, and holds the recording until it is saved', async () => {
  cloud.ok = false;
  const { result } = renderHook(() => useLectureRecorder());
  await act(async () => { await result.current.start(target); });
  await act(async () => { await result.current.stop(); });
  await vi.waitFor(() => expect(result.current.cloudAudio).toBe('failed'));
  cloud.ok = true;
  await act(async () => { await result.current.retryCloudAudio(); });
  expect(result.current.cloudAudio).toBe('saved');
  expect(cloud.uploads).toHaveLength(2);
});
