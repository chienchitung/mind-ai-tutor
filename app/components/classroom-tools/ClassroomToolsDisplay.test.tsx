// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { ClassroomToolsView } from './ClassroomToolsView';
import { ClassroomToolsDisplay } from './ClassroomToolsDisplay';

// An in-memory BroadcastChannel: delivers on a later task to the other
// instances with the same name, as the real one does between windows.
class FakeChannel {
  static open = new Set<FakeChannel>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(public name: string) { FakeChannel.open.add(this); }
  postMessage(data: unknown) {
    for (const other of Array.from(FakeChannel.open)) {
      if (other !== this && other.name === this.name) setTimeout(() => other.onmessage?.({ data } as MessageEvent), 0);
    }
  }
  close() { FakeChannel.open.delete(this); }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  window.localStorage.clear();
  vi.stubGlobal('BroadcastChannel', FakeChannel);
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  cleanup();
  FakeChannel.open.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// Each call is its own act(), so a message delivered in one has its effects
// (e.g. the projector's ticking) in place for the next.
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

it('waits for the tools page when opened on its own', () => {
  render(<LanguageProvider><ClassroomToolsDisplay /></LanguageProvider>);
  expect(screen.getByRole('status').textContent).toContain('等待課堂工具頁連線');
});

it('mirrors the course name, the countdown and the draw of the tools page', () => {
  const tools = render(<LanguageProvider><ClassroomToolsView /></LanguageProvider>);
  const controls = within(tools.container);
  fireEvent.change(controls.getByLabelText('課程名稱'), { target: { value: '資料視覺化' } });

  // Opened later: it asks the tools page for the current state.
  const projector = render(<LanguageProvider><ClassroomToolsDisplay /></LanguageProvider>);
  const screenView = within(projector.container);
  advance(10);
  expect(screenView.getByRole('heading', { name: '資料視覺化' })).toBeTruthy();
  expect(screenView.getByRole('timer').textContent).toBe('05:00');
  // No controls on the projector.
  expect(screenView.queryByRole('button', { name: '開始' })).toBeNull();

  fireEvent.click(controls.getByRole('button', { name: '開始' }));
  advance(10);
  advance(65_000);
  expect(screenView.getByRole('timer').textContent).toBe('03:55');
  fireEvent.click(controls.getByRole('button', { name: '暫停' }));
  advance(10_000);
  expect(screenView.getByRole('timer').textContent).toBe('03:55');
  fireEvent.click(controls.getByRole('button', { name: '開始' }));
  advance(10);
  advance(240_000);
  advance(10);
  expect(screenView.getByRole('timer').textContent).toBe('00:00');
  expect(screenView.getByText('時間到！')).toBeTruthy();

  fireEvent.click(controls.getByRole('tab', { name: /抽籤報告順序/ }));
  advance(10);
  expect(screenView.getByText('等待抽籤')).toBeTruthy();
  fireEvent.click(controls.getByRole('button', { name: '抽出報告順序' }));
  advance(2_000);
  advance(10);
  const order = screenView.getAllByRole('listitem').map((item) => item.textContent?.replace(/^\d+/, ''));
  expect([...order].sort()).toEqual(['第 1 組', '第 2 組', '第 3 組', '第 4 組']);
  expect(screenView.getByRole('status').textContent).toBe('報告順序');
});

it('opens the projector window from the tools page', () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  render(<LanguageProvider><ClassroomToolsView /></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: '開啟投影視窗' }));
  expect(open).toHaveBeenCalledWith('/classroom-tools/display', 'classroom-tools-display', expect.any(String));
});
