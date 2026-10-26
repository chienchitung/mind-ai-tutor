// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { LectureRecordingPanel } from './LectureRecordingPanel';
import { LectureJobsProvider } from './LectureJobsProvider';

vi.mock('@/lib/supabase', () => ({ supabase: () => ({ storage: { from: () => ({ upload: vi.fn() }) } }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/live/60000000-0000-4000-8000-000000000001/present' }));
vi.mock('@/lib/deck-text', () => ({ extractDeckText: vi.fn().mockResolvedValue([]) }));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const view = () => render(
  <LanguageProvider>
    <LectureJobsProvider>
      <LectureRecordingPanel sessionId="60000000-0000-4000-8000-000000000001" sessionTitle="第三課" deckUrl={null} deckPage={1} />
    </LectureJobsProvider>
  </LanguageProvider>,
);
// Before recording, the details are behind the options menu next to "開始錄音".
const openDetails = async () => {
  fireEvent.pointerDown(screen.getByRole('button', { name: '錄音選項' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: '錄音紀錄與詳情…' }));
};
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

it('lists recordings with transcript progress and offers notes only once something is transcribed', async () => {
  fetchMock.mockImplementation(() => json([
    { id: 'a', title: '第三課', status: 'stopped', durationSeconds: 2712, hasNotes: true, createdAt: '2026-10-24T02:00:00Z', transcribed: 10, failed: 0 },
    { id: 'b', title: '第三課', status: 'stopped', durationSeconds: 6, hasNotes: false, createdAt: '2026-10-25T05:18:00Z', transcribed: 0, failed: 1 },
  ]));
  view();
  await openDetails();
  expect(await screen.findByText('查看筆記')).toBeTruthy();
  expect(screen.getByText(/45:12 · 逐字稿 10 段/)).toBeTruthy();
  expect((screen.getByRole('button', { name: /產生教學筆記/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('button', { name: /重試失敗段落/ })).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledWith('/api/live-recordings?sessionId=60000000-0000-4000-8000-000000000001', { cache: 'no-store' });
});

it('explains that the migration is needed when the tables do not exist yet', async () => {
  fetchMock.mockImplementation(() => json({ error: 'RECORDINGS_NOT_READY' }, 503));
  view();
  await openDetails();
  expect(await screen.findByText(/錄音功能尚未啟用/)).toBeTruthy();
});

it('reports a browser without microphone support instead of failing silently', async () => {
  fetchMock.mockImplementation(() => json([]));
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined });
  view();
  screen.getByRole('button', { name: '開始錄音' }).click();
  // The details dialog opens by itself to explain the failure.
  expect(await screen.findByText(/這個瀏覽器不支援錄音/)).toBeTruthy();
});

it('offers to record the screen too, right next to the start button, and remembers the choice', async () => {
  fetchMock.mockImplementation(() => json([]));
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn(), getDisplayMedia: vi.fn() } });
  vi.stubGlobal('MediaRecorder', { isTypeSupported: (type: string) => type.startsWith('video/webm') });
  localStorage.removeItem('mindaitutor.lecture.recordScreen');
  view();
  fireEvent.pointerDown(screen.getByRole('button', { name: '錄音選項' }));
  expect((await screen.findByRole('menuitemradio', { name: /只錄聲音/ })).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('menuitemradio', { name: /錄音＋螢幕畫面/ }));
  expect(await screen.findByRole('button', { name: '開始錄音＋畫面' })).toBeTruthy();
  expect(localStorage.getItem('mindaitutor.lecture.recordScreen')).toBe('1');
  // The same choice is in the details dialog.
  await openDetails();
  expect((screen.getByRole('checkbox', { name: /同時錄製螢幕畫面/ }) as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
});

it('says when the browser cannot record the screen', async () => {
  fetchMock.mockImplementation(() => json([]));
  view();
  fireEvent.pointerDown(screen.getByRole('button', { name: '錄音選項' }));
  const screenOption = await screen.findByRole('menuitemradio', { name: /錄音＋螢幕畫面/ });
  expect(screenOption.getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByText('這個瀏覽器不支援錄製畫面')).toBeTruthy();
});

it('returns focus to the options button when the details opened from the menu are closed', async () => {
  fetchMock.mockImplementation(() => json([]));
  view();
  await openDetails();
  fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '錄音選項' })));
});
