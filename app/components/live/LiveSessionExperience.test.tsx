// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import JoinPage from '@/app/live/page';
import SessionsPage from '@/app/live/sessions/page';
import NewPage from '@/app/live/new/page';
import PresenterPage from '@/app/live/[id]/present/page';
import AudiencePage from '@/app/live/[id]/page';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toast: vi.fn(),
  events: new Map<string, (arg: { payload: unknown }) => void>(),
  subscribeCallback: null as ((status: string) => void) | null,
  send: vi.fn(),
  inkSend: vi.fn(),
}));
vi.mock('next/navigation', () => {
  const router = { push: mocks.push };
  return { useParams: () => ({ id: '123456' }), useRouter: () => router };
});
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock('@/components/live/DeckViewer', () => ({
  DeckViewer: ({ overlay }: { overlay?: ReactNode }) => (
    <div>
      PDF viewer
      {overlay}
    </div>
  ),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: () => {
    const channel = {
      on: (
        _: string,
        { event }: { event: string },
        handler: (arg: { payload: unknown }) => void,
      ) => {
        mocks.events.set(event, handler);
        return channel;
      },
      subscribe: (callback?: (status: string) => void) => {
        mocks.subscribeCallback = callback ?? null;
        callback?.('SUBSCRIBED');
        return channel;
      },
      send: mocks.send,
    };
    return { channel: () => channel, removeChannel: vi.fn() };
  },
}));

const session = {
  sessionId: '123456',
  joinCode: '482910',
  title: 'AI 素養：一起探索生成式 AI',
  status: 'open',
  mode: 'deck', questions: [], answeredIds: [],
  poll: {
    pollId: 'poll-1', phase: 'open',
    question: '當 AI 給出一個看似合理的答案，你會先做什麼？',
    options: [
      '直接採用，AI 的答案通常正確',
      '交叉查證來源，再判斷是否採用',
      '請 AI 再回答一次',
      '和同學討論不同的觀點',
    ],
    voteCounts: [2, 12, 3, 7],
    voteTotal: 24,
  },
  pulse: { pulseAverage: 3.2, pulseTotal: 18, pulseCounts: [1, 2, 10, 3, 2] },
  deckUrl: null,
  deckPage: 1,
};
const questions = [
  {
    id: 'q1',
    text: '如果兩個來源的說法不同，該怎麼判斷可信度？',
    lens: 'clarify',
    visibility: 'public',
    upvotes: 6,
    createdAt: '2026-08-31T10:00:00Z',
  },
];
const response = (data: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => data,
});
let fetchMock: ReturnType<typeof vi.fn>;
function mount(element: ReactNode) {
  return render(<LanguageProvider>{element}</LanguageProvider>);
}
// Optional local visual fixtures: real rendered components, synthetic data, no auth or database.
function capture(name: string) {
  const dir = process.env.LIVE_PREVIEW_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${name}.html`),
    `<!doctype html><html lang="zh-TW"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Live Session — UI fixture</title><link rel="stylesheet" href="style.css"><body>${document.body.innerHTML}</body></html>`,
  );
}
beforeEach(() => {
  mocks.events.clear();
  mocks.push.mockClear();
  mocks.toast.mockClear();
  mocks.send.mockClear();
  mocks.inkSend.mockClear();
  vi.stubGlobal('BroadcastChannel', class { onmessage = null; postMessage = mocks.inkSend; close() {} });
  // Explicit storage doubles also work with Node versions exposing native Web Storage.
  for (const name of ['localStorage', 'sessionStorage']) {
    const values = new Map<string, string>();
    vi.stubGlobal(name, {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear(),
    });
  }
  fetchMock = vi.fn(async (url: string) =>
    response(url.includes('/questions') ? questions : session),
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Live Session experience', () => {
  it('accepts full-width codes and requires six digits before joining', () => {
    mount(<JoinPage />);
    const input = screen.getByLabelText('加入代碼');
    expect(
      (screen.getByRole('button', { name: '加入' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.change(input, { target: { value: '１２３４５６' } });
    fireEvent.click(screen.getByRole('button', { name: '加入' }));
    expect(mocks.push).toHaveBeenCalledWith('/live/123456');
  });

  it('filters sessions and requires explicit confirmation before ending one', async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      response(
        init?.method === 'PATCH'
          ? {}
          : [
              {
                id: 'a',
                title: '探索 AI',
                status: 'open',
                joinCode: '123456',
                createdAt: '2026-08-31T10:00:00Z',
              },
              {
                id: 'b',
                title: '資料素養',
                status: 'closed',
                joinCode: '654321',
                createdAt: '2026-08-30T10:00:00Z',
              },
            ],
      ),
    );
    mount(<SessionsPage />);
    await screen.findByText('探索 AI');
    capture('sessions');
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: '654321' },
    });
    expect(screen.queryByText('探索 AI')).toBeNull();
    expect(screen.getByText('資料素養')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /尚未結束/ }));
    expect(screen.queryByText('資料素養')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '結束' }));
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH'),
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '結束' }));
    fireEvent.click(screen.getByRole('button', { name: '結束場次' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/live-sessions/a',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'closed' }),
        }),
      ),
    );
  });

  it('lets a failed session list retry', async () => {
    fetchMock
      .mockResolvedValueOnce(response({}, false))
      .mockResolvedValue(response([]));
    mount(<SessionsPage />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '再試一次' }));
    await screen.findByText('尚無任何場次。');
  });

  it('validates the first poll and uses an explicit workspace action after creating', async () => {
    fetchMock.mockResolvedValue(
      response({ sessionId: 'new-session', joinCode: '482910' }),
    );
    mount(<NewPage />);
    capture('new-session');
    const submit = screen.getByRole('button', {
      name: '開始場次',
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('場次名稱'), {
      target: { value: ' AI 課堂 ' },
    });
    fireEvent.change(screen.getByLabelText('題目'), {
      target: { value: ' 問題 ' },
    });
    fireEvent.change(screen.getByLabelText('選項 A'), {
      target: { value: ' 是 ' },
    });
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('選項 B'), {
      target: { value: ' 否 ' },
    });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await screen.findByText('場次已建立！');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/live-sessions',
      expect.objectContaining({
        body: JSON.stringify({
          title: 'AI 課堂',
          question: '問題',
          options: ['是', '否'],
        }),
      }),
    );
    // Primary action navigates same-tab (a plain window.open can be blocked
    // by browsers/school device policies) - "in a new tab" is now a
    // secondary, explicit choice instead of the only option.
    const workspaceLink = screen.getByRole('link', {
      name: '開啟工作區',
    }) as HTMLAnchorElement;
    expect(workspaceLink.getAttribute('href')).toBe('/live/new-session/present');
    expect(
      screen.getByRole('button', { name: '在新分頁開啟' }),
    ).toBeTruthy();
  });

  it('creates a blank session with no poll when that mode is chosen', async () => {
    fetchMock.mockResolvedValue(
      response({ sessionId: 'blank-session', joinCode: '111222' }),
    );
    mount(<NewPage />);
    fireEvent.click(screen.getByRole('button', { name: '空白場次' }));
    const submit = screen.getByRole('button', {
      name: '開始場次',
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.queryByLabelText('題目')).toBeNull();
    fireEvent.change(screen.getByLabelText('場次名稱'), {
      target: { value: ' 暖場 ' },
    });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await screen.findByText('場次已建立！');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/live-sessions',
      expect.objectContaining({ body: JSON.stringify({ title: '暖場' }) }),
    );
  });

  it('keeps the presenter controls locked during an update and rolls back on failure', async () => {
    let finish!: (value: unknown) => void;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : response(url.includes('/questions') ? questions : session),
    );
    mount(<PresenterPage />);
    await screen.findByRole('heading', { name: session.title });
    capture('presenter');
    fireEvent.click(screen.getByRole('button', { name: '暫停' }));
    expect(
      (screen.getByRole('button', { name: '繼續課堂' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: '結束' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await act(async () => {
      finish(response({}, false));
    });
    expect(
      (screen.getByRole('button', { name: '暫停' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    );
  });

  it('keeps a poll draft when its dialog is closed, and disables incomplete polls', async () => {
    mount(<PresenterPage />);
    await screen.findByRole('heading', { name: session.title });
    fireEvent.click(screen.getByRole('button', { name: '新增投票' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('題目'), {
      target: { value: '新的問題' },
    });
    expect(
      (
        within(dialog).getByRole('button', {
          name: '建立待開放投票',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '新增投票' }));
    expect((screen.getByLabelText('題目') as HTMLTextAreaElement).value).toBe(
      '新的問題',
    );
  });

  it('maps too-easy and too-hard feedback to the correct stored values and names', async () => {
    mount(<AudiencePage />);
    await screen.findByRole('heading', { name: session.title });
    capture('audience');
    fireEvent.click(screen.getByRole('button', { name: '太簡單' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/live/123456/pulse',
        expect.objectContaining({ body: expect.stringContaining('"value":1') }),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: '太難' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/live/123456/pulse',
        expect.objectContaining({ body: expect.stringContaining('"value":5') }),
      ),
    );
    expect(
      screen.getByRole('button', { name: '太難' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('disables voting and explains the paused state when a status broadcast arrives', async () => {
    mount(<AudiencePage />);
    await screen.findByRole('heading', { name: session.title });
    act(() =>
      mocks.events.get('session:status')?.({ payload: { status: 'paused' } }),
    );
    expect(
      (screen.getByRole('button', { name: /直接採用/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText(/老師暫停了課堂/)).toBeTruthy();
    act(() =>
      mocks.events.get('session:status')?.({ payload: { status: 'closed' } }),
    );
    expect(screen.getByText(/謝謝你的參與/)).toBeTruthy();
  });
  it('mounts the projection dialog before requesting native fullscreen', async () => {
    fetchMock.mockImplementation(async (url: string) => response(url.includes('/questions') ? questions : { ...session, deckUrl: '/deck.pdf' }));
    const original = HTMLElement.prototype.requestFullscreen;
    const fullscreen = vi.fn(async function(this: HTMLElement) { expect(this.isConnected).toBe(true); expect(this.getAttribute('role')).toBe('dialog'); });
    HTMLElement.prototype.requestFullscreen = fullscreen;
    try {
      mount(<PresenterPage />);
      await screen.findByRole('heading', { name: session.title });
      fireEvent.click(screen.getByRole('button', { name: '全螢幕投影' }));
      await waitFor(() => expect(fullscreen).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('dialog', { name: /簡報投影模式/ })).toBeTruthy();
    } finally {
      HTMLElement.prototype.requestFullscreen = original;
    }
  });
  it('keeps the projection overlay open when fullscreen is denied, even if fullscreenchange still fires', async () => {
    fetchMock.mockImplementation(async (url: string) => response(url.includes('/questions') ? questions : { ...session, deckUrl: '/deck.pdf' }));
    const original = HTMLElement.prototype.requestFullscreen;
    HTMLElement.prototype.requestFullscreen = vi.fn(async () => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    });
    try {
      mount(<PresenterPage />);
      await screen.findByRole('heading', { name: session.title });
      fireEvent.click(screen.getByRole('button', { name: '全螢幕投影' }));
      await screen.findByRole('dialog', { name: /簡報投影模式/ });
      // Some browsers still fire fullscreenchange once even on a denied
      // request - document.fullscreenElement stays null either way, which
      // should NOT be mistaken for the user exiting an active fullscreen.
      await act(async () => {
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      expect(screen.getByRole('dialog', { name: /簡報投影模式/ })).toBeTruthy();
    } finally {
      HTMLElement.prototype.requestFullscreen = original;
    }
  });
  it('tells a student when their connection drops and confirms once it recovers', async () => {
    fetchMock.mockImplementation(async (url: string) => response(url.includes('/questions') ? questions : session));
    mount(<AudiencePage />);
    await screen.findByText(session.title);
    // The mock's subscribe() resolves SUBSCRIBED synchronously, so the
    // initial "connecting" badge should already be gone on a normal connect.
    await waitFor(() => expect(screen.queryByText('連線中…')).toBeNull());
    act(() => {
      mocks.subscribeCallback?.('CHANNEL_ERROR');
    });
    expect(await screen.findByText('目前離線，請恢復連線後再次送出回應')).toBeTruthy();
    act(() => {
      mocks.subscribeCallback?.('SUBSCRIBED');
    });
    expect(await screen.findByText('已重新連線')).toBeTruthy();
  });
  it('shows a simplified ended screen with a participation summary and a way to leave', async () => {
    const closedSession = { ...session, status: 'closed', deckUrl: '/deck.pdf' };
    fetchMock.mockImplementation(async (url: string) =>
      response(url.includes('/questions') ? [{ ...questions[0], isMine: true }] : closedSession),
    );
    mount(<AudiencePage />);
    await screen.findByText(/謝謝你的參與/);
    // A regex, not an exact string: the "• " bullet is its own text node,
    // separate from the {t(...)} count text, within the same <li>. The
    // questions fetch also resolves independently of the session fetch above.
    expect(await screen.findByText(/你發問了 1 次/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '查看課堂投影片' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '離開課堂' })).toBeTruthy();
    // The interactive area is gone entirely for a closed session, not just
    // disabled - that's the point of the simplified screen.
    expect(screen.queryByRole('button', { name: '掌聲' })).toBeNull();
  });
});

describe('dual-screen presenting', () => {
  class TestPointer extends MouseEvent {
    pointerId: number;
    isPrimary: boolean;
    constructor(type: string, args: PointerEventInit = {}) {
      super(type, args);
      this.pointerId = args.pointerId ?? 1;
      this.isPrimary = args.isPrimary ?? true;
    }
  }
  beforeEach(() => {
    fetchMock.mockImplementation(async (url: string) =>
      response(url.includes('/questions') ? questions : { ...session, deckUrl: '/deck.pdf' }),
    );
    vi.stubGlobal('PointerEvent', TestPointer);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => true);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 800, height: 400, bottom: 400, right: 800, toJSON: () => ({}),
    });
  });

  it('opens a second window for the projector and shows the drawing toolbar', async () => {
    const displayWindow = { closed: false, close: vi.fn() };
    const open = vi.fn().mockReturnValue(displayWindow);
    vi.stubGlobal('open', open);
    mount(<PresenterPage />);
    await screen.findByRole('heading', { name: session.title });
    expect(screen.queryByRole('button', { name: '畫筆' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '雙螢幕投影' }));
    expect(open).toHaveBeenCalledWith('/live/123456/present/display', 'live-display-123456', 'popup');
    expect(screen.getByRole('button', { name: '畫筆' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '停止雙螢幕投影' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '停止雙螢幕投影' }));
    expect(displayWindow.close).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '畫筆' })).toBeNull();
  });

  it('shows a destructive toast when the popup is blocked', async () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue(null));
    mount(<PresenterPage />);
    await screen.findByRole('heading', { name: session.title });
    fireEvent.click(screen.getByRole('button', { name: '雙螢幕投影' }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(screen.queryByRole('button', { name: '畫筆' })).toBeNull();
  });

  it('sends a drawn stroke over the local channel, never the public student channel', async () => {
    vi.stubGlobal('open', vi.fn().mockReturnValue({ closed: false, close: vi.fn() }));
    mount(<PresenterPage />);
    await screen.findByRole('heading', { name: session.title });
    fireEvent.click(screen.getByRole('button', { name: '雙螢幕投影' }));
    fireEvent.click(screen.getByRole('button', { name: '畫筆' }));
    const surface = screen.getByRole('img', { name: '投影片標註區' });
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(surface, { clientX: 200, clientY: 150, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(surface, { clientX: 200, clientY: 150, pointerId: 1, button: 0 });
    // The dual-screen toggle itself already sends one "catch-up" sync with
    // zero strokes (nothing drawn yet) - wait specifically for the one
    // carrying the just-committed stroke, not just any annotation:sync call.
    await waitFor(() =>
      expect(
        mocks.inkSend.mock.calls.some(
          (call) => call[0]?.type === 'ink' && call[0]?.strokes?.length === 1,
        ),
      ).toBe(true),
    );
    const syncCall = mocks.inkSend.mock.calls.find(
      (call) => call[0]?.type === 'ink' && call[0]?.page === 1 && call[0]?.strokes?.length === 1,
    )!;
    expect(syncCall[0].strokes).toHaveLength(1);
    expect(mocks.send).not.toHaveBeenCalledWith(expect.objectContaining({event:"annotation:sync"}));
  });

  it('uses persisted commands to show a poll and return to slides', async () => {
    mount(<PresenterPage />);
    await screen.findByRole('heading', { name: session.title });
    fireEvent.click(await screen.findByRole('button', { name: '展示投票' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/live-sessions/123456/presentation',expect.objectContaining({method:'POST',body:JSON.stringify({action:'show',mode:'poll'})})));
    await waitFor(() => expect((screen.getByRole('button',{name:'返回簡報'}) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button',{name:'返回簡報'}));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/live-sessions/123456/presentation',expect.objectContaining({body:JSON.stringify({action:'show',mode:'deck'})})));
  });

  it('offers projection only for public questions, never the moderation queue', async () => {
    fetchMock.mockImplementation(async (url:string) => response(url.includes('/questions') ? [...questions,{id:'private',text:'Private question',visibility:'author_only',upvotes:9}] : session));
    mount(<PresenterPage />);
    await screen.findByRole('heading',{name:session.title});
    fireEvent.click(screen.getByText('問答控場：指定問題、標記已回答'));
    expect(screen.getAllByRole('button',{name:'放大這題'})).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'放大這題'}));
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith('/api/live-sessions/123456/presentation',expect.objectContaining({body:JSON.stringify({action:'question',questionId:questions[0].id})})));
  });

});

describe('session deletion and immediate reactions', () => {
  it('shows a local emoji before the HTTP response and ignores its broadcast echo', async () => {
    let finish!: (value: unknown) => void;
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/react')) return new Promise(resolve => { finish = resolve; });
      if (url.includes('/questions')) return Promise.resolve(response([]));
      return Promise.resolve(response(session));
    });
    const { container } = mount(<AudiencePage />);
    await screen.findByRole('heading', {name:session.title});
    fireEvent.click(screen.getByRole('button', {name:'掌聲'}));
    expect(container.querySelectorAll('.live-reaction-float')).toHaveLength(1);
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/react'))!;
    const payload = JSON.parse(call[1].body);
    expect(payload.reactionId).toBeTruthy();
    act(() => mocks.events.get('reaction:sent')!({payload}));
    expect(container.querySelectorAll('.live-reaction-float')).toHaveLength(1);
    await waitFor(() => expect((screen.getByRole('button',{name:'掌聲'}) as HTMLButtonElement).disabled).toBe(false));
    await act(async () => { finish(response({},false)); });
    expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('未能傳送'));
  });
  it('only offers deletion for closed sessions, keeps rows on failure, removes after success', async () => {
    const rows = [{id:'open-1',title:'進行中的課堂',status:'open',joinCode:'111111',createdAt:'2026-08-31'}, {id:'closed-1',title:'已結束的課堂',status:'closed',joinCode:'222222',createdAt:'2026-08-31'}];
    let success = false;
    fetchMock.mockImplementation((_url: string, options?: {method?:string}) => Promise.resolve(options?.method === 'DELETE' ? response({},success) : response(rows)));
    mount(<SessionsPage />);
    await screen.findByRole('heading',{name:'已結束的課堂'});
    expect(screen.getAllByRole('button',{name:'刪除'})).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'刪除'}));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Supabase');
    capture('session-delete');
    fireEvent.click(within(dialog).getByRole('button',{name:'刪除'}));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({variant:'destructive'})));
    expect(screen.getByRole('heading',{name:'已結束的課堂', hidden:true})).toBeTruthy();
    success = true;
    fireEvent.click(within(dialog).getByRole('button',{name:'刪除'}));
    await waitFor(() => expect(screen.queryByRole('heading',{name:'已結束的課堂'})).toBeNull());
    expect(screen.getByRole('heading',{name:'進行中的課堂'})).toBeTruthy();
  });
});
