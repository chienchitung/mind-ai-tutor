// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import type { RecordingSummary } from '@/lib/live-recording';
import { LectureJobsProvider, useLectureJobs } from './LectureJobsProvider';

const nav = vi.hoisted(() => ({ pathname: '/live/recordings' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: React.ReactNode; href: string }) => <a {...props}>{children}</a> }));
vi.mock('@/lib/supabase', () => ({ supabase: () => ({ storage: { from: () => ({ upload: vi.fn() }) } }) }));
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
