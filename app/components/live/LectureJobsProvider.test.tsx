// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import type { RecordingSummary } from '@/lib/live-recording';
import { LectureJobsProvider, useLectureJobs } from './LectureJobsProvider';
import { floatToInt16, memoryVault, type VaultMeta } from '@/lib/recording-vault';

const nav = vi.hoisted(() => ({ pathname: '/live/recordings' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: React.ReactNode; href: string }) => <a {...props}>{children}</a> }));
const vaultHolder = vi.hoisted(() => ({ vault: null as unknown }));
vi.mock('@/lib/recording-vault', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/recording-vault')>();
  return { ...actual, openRecordingVault: async () => vaultHolder.vault };
});
vi.mock('@/lib/supabase', () => ({
  supabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'teacher-1' } }, error: null }) },
    storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
  }),
}));
vi.mock('@/lib/deck-text', () => ({ extractDeckText: vi.fn().mockResolvedValue([]) }));
vi.mock('./LectureNotesDialog', () => ({
  LectureNotesDialog: ({ recordingId }: { recordingId: string | null }) => (recordingId ? <div role="dialog">notes {recordingId}</div> : null),
}));

const item: RecordingSummary = {
  id: 'rec-1', title: '第三課', status: 'stopped', active: false, durationSeconds: 600, hasNotes: false,
  createdAt: '2026-10-25T02:00:00Z', sessionId: 's-1', sessionTitle: '第三課：IF', deckUrl: null, transcribed: 2, failed: 0,
};

let finishNotes!: (value: Response) => void;
beforeEach(() => {
  vaultHolder.vault = null;
  sessionStorage.clear();
  nav.pathname = '/live/recordings';
  vi.stubGlobal('fetch', vi.fn((url: string) => (url.endsWith('/notes')
    ? new Promise<Response>((resolve) => { finishNotes = resolve; })
    : Promise.resolve(new Response('[]')))));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Starter() {
  const { generateNotes } = useLectureJobs();
  return <button type="button" onClick={() => generateNotes(item)}>start</button>;
}
const view = () => render(<LanguageProvider><LectureJobsProvider><Starter /></LectureJobsProvider></LanguageProvider>);
const notesBody = { notes: { title: 't', summary: 's', sections: [], keyTerms: [], studentQuestions: [], reviewQuestions: [] } };

it('keeps writing notes after the teacher leaves the page and offers them from the corner pill', async () => {
  const { rerender } = view();
  fireEvent.click(screen.getByText('start'));
  expect(await screen.findByRole('button', { name: /背景工作: 整理教學筆記/ })).toBeTruthy();

  nav.pathname = '/students';
  rerender(<LanguageProvider><LectureJobsProvider><Starter /></LectureJobsProvider></LanguageProvider>);
  await act(async () => { finishNotes(new Response(JSON.stringify(notesBody))); });

  // Elsewhere, nothing pops over the page; the pill says the notes are ready.
  await waitFor(() => expect(screen.getByRole('button', { name: /背景工作: 教學筆記完成/ })).toBeTruthy());
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /背景工作/ }));
  fireEvent.click(await screen.findByRole('button', { name: /查看筆記/ }));
  expect(screen.getByRole('dialog').textContent).toContain('rec-1');
});

it('opens the notes right away when the teacher is still where they started', async () => {
  view();
  fireEvent.click(screen.getByText('start'));
  await act(async () => { finishNotes(new Response(JSON.stringify(notesBody))); });
  await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('rec-1'));
  expect(screen.queryByRole('button', { name: /背景工作/ })).toBeNull();
});

it('reports a failed job in the pill', async () => {
  view();
  fireEvent.click(screen.getByText('start'));
  await act(async () => { finishNotes(new Response(JSON.stringify({ error: 'INSUFFICIENT_POINTS' }), { status: 402 })); });
  await waitFor(() => expect(screen.getByRole('button', { name: /背景工作: 有工作失敗/ })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /背景工作/ }));
  expect(await screen.findByText('AI 點數不足。')).toBeTruthy();
});

it('offers to finish a recording an earlier visit left behind, and closes it on the server', async () => {
  const vault = memoryVault();
  const meta: VaultMeta = {
    recordingId: 'crashed', userId: 'teacher-1', sessionId: 's-1', title: '第五課', language: 'zh-TW', startedAt: Date.now() - 60_000,
    tailStartSeconds: 300, nextIdx: 1, elapsedSeconds: 330, marks: [{ t: 0, page: 1 }], finished: false,
  };
  await vault.putMeta(meta);
  await vault.appendTail('crashed', floatToInt16(new Float32Array(16_000 * 30).fill(0.1)));
  await vault.appendMedia('crashed', new Blob(['opus'], { type: 'audio/webm' }));
  // Another teacher's leftovers on the same computer are never shown.
  await vault.putMeta({ ...meta, recordingId: 'someone-else', userId: 'teacher-2' });
  vaultHolder.vault = vault;
  const fetchMock = vi.fn(async () => new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  view();

  fireEvent.click(await screen.findByRole('button', { name: /背景工作: 有錄音沒有正常結束/ }));
  expect(screen.getByText(/約 0:30 尚未轉錄/)).toBeTruthy();
  expect(screen.queryByText('someone-else')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '補傳並轉錄' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/live-recordings/crashed', expect.objectContaining({ method: 'PATCH' })));
  expect(fetchMock).toHaveBeenCalledWith('/api/live-recordings/crashed/segments', expect.objectContaining({
    body: JSON.stringify({ idx: 1, startSeconds: 300, durationSeconds: 30, language: 'zh-TW' }),
  }));
  // Closed with its real length; the download copy is still offered.
  const patch = (fetchMock.mock.calls as unknown as [string, RequestInit][]).find(([url, init]) => url === '/api/live-recordings/crashed' && init.method === 'PATCH')!;
  expect(JSON.parse(String(patch[1].body))).toEqual({ durationSeconds: 330, slideMarks: [{ t: 0, page: 1 }], status: 'stopped' });
  expect(await screen.findByText('逐字稿已完成；完整錄音檔還保存在這台電腦，可以下載。')).toBeTruthy();
});

it('does not offer a recording that another open tab is still making', async () => {
  const vault = memoryVault();
  await vault.putMeta({
    recordingId: 'live-elsewhere', userId: 'teacher-1', sessionId: 's-1', title: '第六課', language: 'zh-TW', startedAt: Date.now() - 60_000,
    tailStartSeconds: 0, nextIdx: 0, elapsedSeconds: 55, marks: [], finished: false,
    // Saved seconds ago by the recording tab (no Web Locks in jsdom).
    heartbeatAt: Date.now() - 3_000,
  });
  await vault.appendTail('live-elsewhere', floatToInt16(new Float32Array(16_000 * 5)));
  vaultHolder.vault = vault;
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  view();
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  expect(screen.queryByRole('button', { name: /背景工作/ })).toBeNull();
});

const finishedMeta = (recordingId: string, extra: Partial<VaultMeta> = {}): VaultMeta => ({
  recordingId, userId: 'teacher-1', sessionId: 's-1', title: 'test', language: 'zh-TW', startedAt: Date.now() - 60_000,
  tailStartSeconds: 45, nextIdx: 1, elapsedSeconds: 45, marks: [], finished: true, ...extra,
});

it('says a finished recording is transcribed, not that notes are ready, and can be closed', async () => {
  const vault = memoryVault();
  await vault.putMeta(finishedMeta('done-1'));
  await vault.appendMedia('done-1', new Blob(['opus'], { type: 'audio/webm' }));
  vaultHolder.vault = vault;
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  view();

  const pill = await screen.findByRole('button', { name: '背景工作: 轉錄完成・錄音檔可下載' });
  expect(screen.queryByText(/教學筆記完成/)).toBeNull();
  fireEvent.click(pill);
  fireEvent.click(await screen.findByRole('button', { name: '關閉' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: /背景工作/ })).toBeNull());
  // Closing only hides it: the copy is still there to download later.
  expect(await vault.readMedia('done-1')).toHaveLength(1);
});

it('clears a finished recording whose file was already downloaded', async () => {
  const vault = memoryVault();
  await vault.putMeta(finishedMeta('saved-1', { downloaded: true }));
  await vault.appendMedia('saved-1', new Blob(['opus'], { type: 'audio/webm' }));
  vaultHolder.vault = vault;
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  view();
  await waitFor(async () => expect(await vault.listMeta()).toEqual([]));
  expect(screen.queryByRole('button', { name: /背景工作/ })).toBeNull();
});

it('keeps a recording that did not finish even when the teacher closes the rest', async () => {
  const vault = memoryVault();
  await vault.putMeta(finishedMeta('done-2'));
  await vault.appendMedia('done-2', new Blob(['opus'], { type: 'audio/webm' }));
  await vault.putMeta(finishedMeta('crashed-2', { finished: false, title: '第七課' }));
  await vault.appendTail('crashed-2', floatToInt16(new Float32Array(16_000 * 10)));
  vaultHolder.vault = vault;
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  view();
  fireEvent.click(await screen.findByRole('button', { name: /背景工作: 有錄音沒有正常結束/ }));
  fireEvent.click(screen.getByRole('button', { name: '關閉' }));
  fireEvent.click(await screen.findByRole('button', { name: /背景工作: 有錄音沒有正常結束/ }));
  expect(screen.getByText('第七課')).toBeTruthy();
  expect(screen.queryByText('test')).toBeNull();
});
