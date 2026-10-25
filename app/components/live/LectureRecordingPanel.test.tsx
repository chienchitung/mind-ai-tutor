// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

it('lists recordings with transcript progress and offers notes only once something is transcribed', async () => {
  fetchMock.mockImplementation(() => json([
    { id: 'a', title: '第三課', status: 'stopped', durationSeconds: 2712, hasNotes: true, createdAt: '2026-10-24T02:00:00Z', transcribed: 10, failed: 0 },
    { id: 'b', title: '第三課', status: 'stopped', durationSeconds: 6, hasNotes: false, createdAt: '2026-10-25T05:18:00Z', transcribed: 0, failed: 1 },
  ]));
  view();
  fireEvent.click(screen.getByRole('button', { name: '錄音詳情與紀錄' }));
  expect(await screen.findByText('查看筆記')).toBeTruthy();
  expect(screen.getByText(/45:12 · 逐字稿 10 段/)).toBeTruthy();
  expect((screen.getByRole('button', { name: /產生教學筆記/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('button', { name: /重試失敗段落/ })).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledWith('/api/live-recordings?sessionId=60000000-0000-4000-8000-000000000001', { cache: 'no-store' });
});

it('explains that the migration is needed when the tables do not exist yet', async () => {
  fetchMock.mockImplementation(() => json({ error: 'RECORDINGS_NOT_READY' }, 503));
  view();
  fireEvent.click(screen.getByRole('button', { name: '錄音詳情與紀錄' }));
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
