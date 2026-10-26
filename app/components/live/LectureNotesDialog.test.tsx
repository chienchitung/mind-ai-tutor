// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { LectureNotesDialog } from './LectureNotesDialog';

vi.mock('./DeckViewer', () => ({
  DeckViewer: ({ url, page }: { url: string; page: number }) => <div data-testid="deck">{url}#{page}</div>,
}));

const notes = {
  title: 'IF 函數', summary: '介紹 IF。',
  sections: [
    { heading: '語法', slidePages: [2, 3], startSeconds: 65, points: ['條件放第一個參數'], examples: [], emphasis: ['逗號要用半形，考試常錯'] },
    { heading: '課堂問答', slidePages: [], startSeconds: null, points: ['IF 最多 64 層'], examples: [], emphasis: [] },
  ],
  keyTerms: [], studentQuestions: [], reviewQuestions: [],
  uncoveredSlides: [{ page: 4, title: '巢狀 IF' }, { page: 5, title: '' }],
};
const segments = [
  { idx: 0, startSeconds: 0, durationSeconds: 300, status: 'transcribed', transcript: '[0:00] 同學好\n\n[1:00] 先看 IF 的語法\n\n[2:30] 接著巢狀', error: null },
];
let detail: Record<string, unknown>;
const scrolled: Element[] = [];

beforeEach(() => {
  detail = { title: '第三課', notes, durationSeconds: 300, segments, deckUrl: 'https://cdn.test/deck.pdf' };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(detail))));
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function scrollIntoView() { scrolled.push(this); };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const view = () => render(<LanguageProvider><LectureNotesDialog recordingId="rec-1" initialNotes={null} onClose={() => undefined} /></LanguageProvider>);

it('shows the slide a section is about, next to the notes', async () => {
  view();
  const chip = await screen.findByRole('button', { name: '查看投影片第 2–3 頁' });
  expect(screen.getByText('逗號要用半形，考試常錯')).toBeTruthy();
  fireEvent.click(chip);
  expect(screen.getByTestId('deck').textContent).toBe('https://cdn.test/deck.pdf#2');
  fireEvent.click(screen.getByRole('button', { name: '下一頁' }));
  expect(screen.getByTestId('deck').textContent).toBe('https://cdn.test/deck.pdf#3');
  fireEvent.click(chip);
  expect(screen.queryByTestId('deck')).toBeNull();
});

it('lists the slides this recording did not cover, each viewable', async () => {
  view();
  expect(await screen.findByText('這次錄音沒講到的投影片')).toBeTruthy();
  expect(screen.getByText('巢狀 IF')).toBeTruthy();
  expect(screen.getByText('（圖片頁）')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: '查看' })[0]);
  expect(screen.getByTestId('deck').textContent).toBe('https://cdn.test/deck.pdf#4');
});

it('jumps from a section time to that moment of the transcript', async () => {
  view();
  fireEvent.click(await screen.findByRole('button', { name: '查看 1:05 的逐字稿' }));
  // 1:05 falls in the paragraph that starts at 1:00.
  await waitFor(() => expect(scrolled.at(-1)?.textContent).toContain('先看 IF 的語法'));
  expect((scrolled.at(-1) as HTMLElement).className).toContain('bg-amber');
});

it('still opens notes made before slides were linked, without a deck', async () => {
  const { uncoveredSlides: _omit, ...older } = notes;
  detail = { ...detail, deckUrl: null, notes: { ...older, sections: older.sections.map(({ emphasis: _e, ...section }) => section) } };
  view();
  expect(await screen.findByText('條件放第一個參數')).toBeTruthy();
  expect(screen.getByText('第 2–3 頁')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /查看投影片/ })).toBeNull();
  expect(screen.queryByText('這次錄音沒講到的投影片')).toBeNull();
});
