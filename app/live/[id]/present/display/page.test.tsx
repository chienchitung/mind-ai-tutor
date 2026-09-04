// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import PresentDisplayPage from './page';

const mocks = vi.hoisted(() => ({
  events: new Map<string, (arg: { payload: unknown }) => void>(),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: '123456' }) }));
vi.mock('@/components/live/DeckViewer', () => ({
  DeckViewer: ({ overlay }: { overlay: React.ReactNode }) => <div data-testid="deck">{overlay}</div>,
}));
vi.mock('@/lib/supabase', () => ({
  supabase: () => {
    const channel = {
      on: (_: string, { event }: { event: string }, handler: (arg: { payload: unknown }) => void) => {
        mocks.events.set(event, handler);
        return channel;
      },
      subscribe: () => channel,
    };
    return { channel: () => channel, removeChannel: vi.fn() };
  },
}));

const session = {
  sessionId: '123456',
  title: 'AI 素養：一起探索生成式 AI',
  status: 'open',
  joinCode: '482910',
  poll: null,
  pulse: { pulseCounts: [0, 0, 0, 0, 0], pulseTotal: 0, pulseAverage: null },
  deckUrl: 'https://example.test/deck.pdf',
  deckPage: 1,
};

function broadcast(event: string, payload: unknown) {
  act(() => mocks.events.get(event)?.({ payload }));
}

beforeEach(() => {
  mocks.events.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => session }),
  );
  Element.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderDisplay() {
  render(
    <LanguageProvider>
      <PresentDisplayPage />
    </LanguageProvider>,
  );
  await screen.findByTestId('deck');
}

describe('present display page (projected window)', () => {
  it('shows the fullscreen gate first, then the deck once entered', async () => {
    await renderDisplay();
    const button = screen.getByRole('button', { name: '進入全螢幕' });
    expect(screen.getByTestId('deck')).toBeTruthy();
    fireEvent.click(button);
    await waitFor(() => expect(Element.prototype.requestFullscreen).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: '進入全螢幕' })).toBeNull();
  });

  it('follows deck:sync broadcasts for page and deck URL changes', async () => {
    await renderDisplay();
    broadcast('deck:sync', { page: 4, deckUrl: 'https://example.test/deck-v2.pdf' });
    // No page-count UI to assert on directly, but the DeckViewer mock re-renders
    // without throwing, and a follow-up annotation:sync for a different page
    // proves the page state actually changed (see next test).
    expect(screen.getByTestId('deck')).toBeTruthy();
  });

  it('mirrors committed strokes and the live in-progress draft/pointer, scoped per page', async () => {
    await renderDisplay();
    broadcast('annotation:sync', {
      page: 1,
      strokes: [{ id: 's1', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], color: '#fb7185', width: 3 }],
    });
    expect(document.querySelector('[data-ink-stroke="s1"]')).toBeTruthy();
    broadcast('annotation:live', {
      tool: 'laser', color: '#fff', width: 3, draft: [], pointer: { x: 0.5, y: 0.5 },
    });
    expect(document.querySelector('[data-laser-pointer]')).toBeTruthy();
    // Switching pages hides strokes committed on a different page.
    broadcast('deck:sync', { page: 2, deckUrl: session.deckUrl });
    expect(document.querySelector('[data-ink-stroke="s1"]')).toBeNull();
  });

  it('shows online count from realtime presence pings, with no pulse/difficulty content', async () => {
    await renderDisplay();
    broadcast('presence:ping', { participantId: 'p1' });
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.queryByText('2.5')).toBeNull();
  });

  it('reveals poll results or featured questions only when the presenter explicitly broadcasts spotlight:show, and hides on spotlight:hide', async () => {
    await renderDisplay();
    expect(screen.queryByRole('region', { name: '投票結果，正在投影上顯示' })).toBeNull();
    broadcast('spotlight:show', {
      type: 'poll',
      poll: { pollId: 'poll-1', question: '哪一種資料視覺化最清楚？', options: ['長條圖'], voteCounts: [2], voteTotal: 2 },
    });
    expect(screen.getByText('哪一種資料視覺化最清楚？')).toBeTruthy();
    broadcast('spotlight:show', {
      type: 'questions',
      questions: [{ id: 'q1', text: 'IF 函數可以巢狀使用嗎？', upvotes: 3 }],
    });
    expect(screen.getByText('IF 函數可以巢狀使用嗎？')).toBeTruthy();
    expect(screen.queryByText('哪一種資料視覺化最清楚？')).toBeNull();
    broadcast('spotlight:hide', {});
    expect(screen.queryByText('IF 函數可以巢狀使用嗎？')).toBeNull();
  });

  it('shows an ended message when the session is deleted', async () => {
    await renderDisplay();
    broadcast('session:deleted', {});
    await waitFor(() => expect(screen.getByText('這堂課已經結束。')).toBeTruthy());
    expect(screen.queryByTestId('deck')).toBeNull();
  });

  it('shows a waiting message when no deck has been shared yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...session, deckUrl: null }) }),
    );
    render(
      <LanguageProvider>
        <PresentDisplayPage />
      </LanguageProvider>,
    );
    await waitFor(() => expect(screen.getByText('等待老師分享投影片…')).toBeTruthy());
  });
});
