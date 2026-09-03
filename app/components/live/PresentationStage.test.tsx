// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { AnnotationLayer } from './AnnotationLayer';
import { PresentationStage } from './PresentationStage';

vi.mock('./DeckViewer', () => ({
  DeckViewer: ({ overlay }: { overlay: ReactNode }) => <div>{overlay}</div>,
}));
class TestPointer extends MouseEvent {
  pointerId: number;
  isPrimary: boolean;
  pointerType: string;
  constructor(type: string, args: PointerEventInit = {}) {
    super(type, args);
    this.pointerId = args.pointerId ?? 1;
    this.isPrimary = args.isPrimary ?? true;
    this.pointerType = args.pointerType ?? 'mouse';
  }
}
beforeEach(() => {
  vi.stubGlobal('PointerEvent', TestPointer);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => true);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 800,
    height: 400,
    bottom: 400,
    right: 800,
    toJSON: () => ({}),
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const down = (el: Element, x: number, y: number) =>
  fireEvent.pointerDown(el, { clientX: x, clientY: y, pointerId: 1, button: 0 });
const move = (el: Element, x: number, y: number) =>
  fireEvent.pointerMove(el, { clientX: x, clientY: y, pointerId: 1, buttons: 1 });
const up = (el: Element, x: number, y: number) =>
  fireEvent.pointerUp(el, { clientX: x, clientY: y, pointerId: 1, button: 0 });
function draw(surface: Element) {
  down(surface, 100, 100);
  move(surface, 200, 150);
  up(surface, 300, 200);
}
function Harness() {
  const [open, setOpen] = useState(true),
    [page, setPage] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <LanguageProvider>
      <button onClick={() => setOpen(true)}>Reopen</button>
      <PresentationStage
        ref={ref}
        open={open}
        url="/fixture.pdf"
        page={page}
        numPages={3}
        title="Test deck"
        joinCode="482910"
        onExit={() => setOpen(false)}
        onPageChange={setPage}
        onNumPages={() => {}}
      />
    </LanguageProvider>
  );
}

describe('projection tools', () => {
  it('commits normalized pen strokes only on release and cancels interrupted strokes', () => {
    const commit = vi.fn(),
      drawing = vi.fn();
    render(
      <AnnotationLayer
        strokes={[]}
        tool="pen"
        color="#fb7185"
        width={3}
        label="canvas"
        onCommit={commit}
        onDrawingChange={drawing}
      />,
    );
    const surface = screen.getByRole('img', { name: 'canvas' });
    down(surface, 100, 100);
    move(surface, 200, 150);
    expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerCancel(surface, { pointerId: 1 });
    expect(commit).not.toHaveBeenCalled();
    draw(surface);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0][0].points[0]).toEqual({ x: 0.125, y: 0.25 });
    expect(drawing).toHaveBeenLastCalledWith(false);
  });
  it('ignores right clicks and additional touch pointers while drawing', () => {
    const commit = vi.fn();
    render(
      <AnnotationLayer
        strokes={[]}
        tool="pen"
        color="#fff"
        width={3}
        label="canvas"
        onCommit={commit}
        onDrawingChange={() => {}}
      />,
    );
    const surface = screen.getByRole('img');
    fireEvent.pointerDown(surface, { button: 2, pointerId: 1 });
    up(surface, 100, 100);
    fireEvent.pointerDown(surface, { button: 0, pointerId: 2, isPrimary: false });
    fireEvent.pointerUp(surface, { button: 0, pointerId: 2 });
    expect(commit).not.toHaveBeenCalled();
  });
  it('keeps laser movement transient, without creating strokes', () => {
    const commit = vi.fn();
    const { container } = render(
      <AnnotationLayer
        strokes={[]}
        tool="laser"
        color="#fff"
        width={3}
        label="canvas"
        onCommit={commit}
        onDrawingChange={() => {}}
      />,
    );
    const surface = screen.getByRole('img');
    move(surface, 300, 200);
    const dot = container.querySelector('[data-laser-pointer]');
    expect(dot).toBeTruthy();
    // A plain positioned div (percentage left/top), not an SVG circle relying
    // on vector-effect="non-scaling-stroke" under the surface's non-uniform
    // (preserveAspectRatio="none") scale - that combination renders invisibly
    // in some browsers, which is why the laser tool wasn't showing up.
    expect(dot?.tagName).toBe('DIV');
    expect((dot as HTMLElement).style.left).toBe('37.5%');
    expect((dot as HTMLElement).style.top).toBe('50%');
    fireEvent.pointerLeave(surface);
    expect(container.querySelector('[data-laser-pointer]')).toBeNull();
    expect(commit).not.toHaveBeenCalled();
  });
  it('keeps notes per slide and after closing, and supports undo and redo', async () => {
    render(<Harness />);
    let surface = await screen.findByRole('img', { name: '投影片標註區' });
    fireEvent.keyDown(surface, { key: 'p' });
    draw(surface);
    expect(document.querySelectorAll('[data-ink-stroke]')).toHaveLength(1);
    fireEvent.keyDown(surface, { key: 'ArrowRight' });
    expect(screen.getByRole('status', { name: /投影片第/ }).textContent).toContain('2 / 3');
    expect(document.querySelectorAll('[data-ink-stroke]')).toHaveLength(0);
    surface = screen.getByRole('img');
    fireEvent.keyDown(surface, { key: 'ArrowLeft' });
    expect(document.querySelectorAll('[data-ink-stroke]')).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole('img'), { key: 'z', ctrlKey: true });
    expect(document.querySelectorAll('[data-ink-stroke]')).toHaveLength(0);
    fireEvent.keyDown(screen.getByRole('img'), { key: 'z', metaKey: true, shiftKey: true });
    expect(document.querySelectorAll('[data-ink-stroke]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '退出投影' }));
    fireEvent.click(screen.getByText('Reopen'));
    await screen.findByRole('img');
    expect(document.querySelectorAll('[data-ink-stroke]')).toHaveLength(1);
  });
  it('opens a right-click menu within the projection dialog and does not navigate while using it', async () => {
    render(<Harness />);
    const surface = await screen.findByRole('img');
    fireEvent.contextMenu(surface, { clientX: 300, clientY: 100 });
    const menu = await screen.findByRole('menu');
    expect(screen.getByRole('dialog').contains(menu)).toBe(true);
    fireEvent.keyDown(menu, { key: 'ArrowRight' });
    expect(screen.getByRole('status', { name: /投影片第/ }).textContent).toContain('1 / 3');
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /畫筆/ }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    draw(screen.getByRole('img'));
    expect(document.querySelectorAll('[data-ink-stroke]')).toHaveLength(1);
  });
  it('erases strokes with a gesture and lets that gesture be undone', async () => {
    render(<Harness />);
    const surface = await screen.findByRole('img');
    fireEvent.keyDown(surface, { key: 'p' });
    draw(surface);
    fireEvent.keyDown(surface, { key: 'e' });
    down(surface, 200, 20);
    up(surface, 200, 300);
    expect(document.querySelectorAll('[data-ink-stroke]')).toHaveLength(0);
    fireEvent.keyDown(surface, { key: 'z', ctrlKey: true });
    expect(document.querySelectorAll('[data-ink-stroke]')).toHaveLength(1);
  });
  it('does not turn Space on a toolbar button into a page change', async () => {
    render(<Harness />);
    await screen.findByRole('img');
    fireEvent.keyDown(screen.getByRole('button', { name: '投影工具' }), { key: ' ' });
    expect(screen.getByRole('status', { name: /投影片第/ }).textContent).toContain('1 / 3');
  });
  it('leaves an already-hidden toolbar hidden when paging via keyboard/clicker - only pointer movement wakes it', async () => {
    render(<Harness />);
    const surface = await screen.findByRole('img');
    const topBar = document.querySelector('[data-presentation-ui]') as HTMLElement;
    expect(topBar.className).toContain('opacity-100');

    await new Promise((resolve) => setTimeout(resolve, 2900));
    await waitFor(() => expect(topBar.className).toContain('opacity-0'));

    fireEvent.keyDown(surface, { key: 'ArrowRight' });
    expect(screen.getByRole('status', { name: /投影片第/ }).textContent).toContain('2 / 3');
    expect(topBar.className).toContain('opacity-0');

    fireEvent.pointerMove(screen.getByRole('dialog'), { clientX: 10, clientY: 10, pointerId: 1 });
    expect(topBar.className).toContain('opacity-100');
  }, 10000);
  it('shows the selected tool beside the last pointer position', async () => {
    vi.stubGlobal('localStorage', { getItem: () => '1', setItem: vi.fn() });
    render(<Harness />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.pointerMove(dialog, { clientX: 240, clientY: 160, pointerId: 1 });
    fireEvent.keyDown(screen.getByRole('img'), { key: 'p' });
    const announcement = screen
      .getAllByRole('status')
      .find((element) => element.textContent?.includes('畫筆'))!;
    expect(announcement.textContent).toContain('畫筆');
    expect(announcement.textContent).toContain('細');
    expect((announcement as HTMLElement).style.left).toBe('254px');
    expect((announcement as HTMLElement).style.top).toBe('174px');
  });
  it('remembers the presenter toolbar pin preference', async () => {
    let pinned = '0';
    vi.stubGlobal('localStorage', {
      getItem: (key: string) =>
        key === 'live-presentation-onboarding-seen' ? '1' : pinned,
      setItem: (key: string, value: string) => {
        if (key === 'live-presentation-controls-pinned-v1') pinned = value;
      },
    });
    const first = render(<Harness />);
    const pin = await screen.findByRole('button', { name: '固定顯示控制列' });
    fireEvent.click(pin);
    expect(pinned).toBe('1');
    first.unmount();
    render(<Harness />);
    const unpin = await screen.findByRole('button', { name: '自動隱藏控制列' });
    expect(unpin.getAttribute('aria-pressed')).toBe('true');
  });
  it('shows a one-time onboarding tip on first open and remembers it was dismissed', async () => {
    let seen: string | null = null;
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key === 'live-presentation-onboarding-seen' ? seen : null),
      setItem: (key: string, value: string) => {
        if (key === 'live-presentation-onboarding-seen') seen = value;
      },
    });
    render(<Harness />);
    await screen.findByRole('img');
    expect(screen.getByRole('button', { name: '知道了，不再顯示' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '知道了，不再顯示' }));
    expect(screen.queryByRole('button', { name: '知道了，不再顯示' })).toBeNull();
    expect(seen).toBe('1');
  });
  it('does not show the onboarding tip once it has already been seen', async () => {
    vi.stubGlobal('localStorage', { getItem: () => '1', setItem: vi.fn() });
    render(<Harness />);
    await screen.findByRole('img');
    expect(screen.queryByRole('button', { name: '知道了，不再顯示' })).toBeNull();
  });
  it('shows small class signals (online count, pulse, latest questions) regardless of toolbar visibility', async () => {
    vi.stubGlobal('localStorage', { getItem: () => '1', setItem: vi.fn() });
    render(
      <LanguageProvider>
        <PresentationStage
          open
          url="/fixture.pdf"
          page={1}
          numPages={3}
          title="Test deck"
          joinCode="482910"
          onExit={() => {}}
          onPageChange={() => {}}
          onNumPages={() => {}}
          onlineCount={12}
          pulseAverage={3.4}
          latestQuestions={[{ id: 'q1', text: '這題怎麼算？' }]}
        />
      </LanguageProvider>,
    );
    await screen.findByRole('img');
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3.4')).toBeTruthy();
    expect(screen.getByText('這題怎麼算？')).toBeTruthy();
  });
});

describe('Slido-style Q&A/poll panel', () => {
  const poll = {
    pollId: 'poll-1',
    question: '哪一種資料視覺化最清楚？',
    options: ['長條圖', '折線圖'],
    voteCounts: [3, 1],
    voteTotal: 4,
  };
  const questions = [
    {
      id: 'q1',
      text: 'IF 函數可以巢狀使用嗎？',
      lens: 'clarify' as const,
      visibility: 'public' as const,
      upvotes: 2,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  function renderStage(overrides: Partial<ComponentProps<typeof PresentationStage>> = {}) {
    return render(
      <LanguageProvider>
        <PresentationStage
          open
          url="/fixture.pdf"
          page={1}
          numPages={3}
          title="Test deck"
          joinCode="482910"
          onExit={() => {}}
          onPageChange={() => {}}
          onNumPages={() => {}}
          poll={poll}
          questions={questions}
          moderatingId={null}
          onModerateQuestion={() => {}}
          onOpenPoll={async () => true}
          {...overrides}
        />
      </LanguageProvider>,
    );
  }

  it('stays closed until the toggle button is used, then shows Q&A by default', async () => {
    renderStage();
    await screen.findByRole('img');
    expect(screen.queryByText('IF 函數可以巢狀使用嗎？')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '問答與投票' }));
    expect(screen.getByText('IF 函數可以巢狀使用嗎？')).toBeTruthy();
    expect(screen.getByText('▲ 2')).toBeTruthy();
  });

  it('moderates a question from inside the panel without leaving fullscreen', async () => {
    const onModerateQuestion = vi.fn();
    renderStage({ onModerateQuestion });
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: '問答與投票' }));
    fireEvent.click(screen.getByRole('button', { name: '隱藏' }));
    expect(onModerateQuestion).toHaveBeenCalledWith(questions[0]);
  });

  it('switches to the poll tab and shows live results', async () => {
    renderStage();
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: '問答與投票' }));
    fireEvent.click(screen.getByRole('button', { name: '目前投票' }));
    expect(screen.getByText('哪一種資料視覺化最清楚？')).toBeTruthy();
    expect(screen.getByText('75% (3)')).toBeTruthy();
    expect(screen.getByText('4 人已答')).toBeTruthy();
  });

  it('opens a new poll from the fullscreen composer', async () => {
    const onOpenPoll = vi.fn().mockResolvedValue(true);
    renderStage({ poll: null, onOpenPoll });
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: '問答與投票' }));
    fireEvent.click(screen.getByRole('button', { name: '目前投票' }));
    expect(screen.getByText('目前沒有進行中的投票。')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '新增投票' }));
    fireEvent.change(screen.getByPlaceholderText('題目'), {
      target: { value: '大家覺得今天的進度如何？' },
    });
    fireEvent.change(screen.getByPlaceholderText('選項 A'), { target: { value: '太快' } });
    fireEvent.change(screen.getByPlaceholderText('選項 B'), { target: { value: '剛好' } });
    fireEvent.click(screen.getByRole('button', { name: '開啟投票' }));
    await waitFor(() =>
      expect(onOpenPoll).toHaveBeenCalledWith('大家覺得今天的進度如何？', ['太快', '剛好']),
    );
  });

  it('excludes panel content from projection keyboard shortcuts', async () => {
    renderStage();
    const surface = await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: '問答與投票' }));
    fireEvent.click(screen.getByRole('button', { name: '目前投票' }));
    fireEvent.click(screen.getByRole('button', { name: '新增投票' }));
    const textarea = screen.getByPlaceholderText('題目');
    // Typing "p" in a form field inside the panel must not switch the
    // drawing tool to pen, same guard as any other input on the stage.
    fireEvent.keyDown(textarea, { key: 'p' });
    fireEvent.keyDown(textarea, { key: 'ArrowRight' });
    expect(screen.getByRole('status', { name: /投影片第/ }).textContent).toContain('1 / 3');
    expect(surface).toBeTruthy();
  });
});
