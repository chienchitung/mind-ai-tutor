// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LanguageProvider } from '@/app/contexts/LanguageContext';
import { ClassroomToolsView } from './ClassroomToolsView';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  window.localStorage.clear();
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const view = () => render(<LanguageProvider><ClassroomToolsView /></LanguageProvider>);
const clock = () => screen.getByRole('timer').textContent;
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

it('counts down from the chosen length, with music, and says when time is up', () => {
  view();
  expect(clock()).toBe('05:00');
  fireEvent.click(screen.getByRole('button', { name: '3 分鐘' }));
  expect(clock()).toBe('03:00');
  fireEvent.click(screen.getByRole('button', { name: '開始' }));
  expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  advance(61_000);
  expect(clock()).toBe('01:59');
  fireEvent.click(screen.getByRole('button', { name: '增加 1 分鐘' }));
  expect(clock()).toBe('02:59');
  fireEvent.click(screen.getByRole('button', { name: '暫停' }));
  advance(10_000);
  expect(clock()).toBe('02:59');
  fireEvent.click(screen.getByRole('button', { name: '開始' }));
  advance(180_000);
  expect(clock()).toBe('00:00');
  expect(screen.getByText('時間到！')).toBeTruthy();
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '重設' }));
  expect(clock()).toBe('03:00');
});

it('takes a custom length in minutes, and mutes the music', () => {
  view();
  fireEvent.change(screen.getByLabelText('自訂分鐘數'), { target: { value: '7.5' } });
  fireEvent.click(screen.getByRole('button', { name: '設定' }));
  expect(clock()).toBe('07:30');
  fireEvent.click(screen.getByRole('button', { name: '背景音樂靜音' }));
  fireEvent.click(screen.getByRole('button', { name: '開始' }));
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

it('lets the teacher rename the course and the groups, change the count, and draws an order of every group', () => {
  const { unmount } = view();
  fireEvent.change(screen.getByLabelText('課程名稱'), { target: { value: 'PMA 儀表板工作坊' } });
  fireEvent.change(screen.getByLabelText('組數'), { target: { value: '3' } });
  fireEvent.blur(screen.getByLabelText('組數'));
  expect(screen.getAllByLabelText(/^第 \d 組名稱$/)).toHaveLength(3);
  fireEvent.change(screen.getByLabelText('第 2 組名稱'), { target: { value: '藍隊' } });

  fireEvent.click(screen.getByRole('button', { name: '抽出報告順序' }));
  advance(2_000);
  const order = within(screen.getByRole('list', { name: '報告順序' })).getAllByRole('listitem').map((item) => item.textContent?.replace(/^\d/, ''));
  expect([...order].sort()).toEqual(['第 1 組', '第 3 組', '藍隊'].sort());

  // All of it is still there next time.
  unmount();
  view();
  expect((screen.getByLabelText('課程名稱') as HTMLInputElement).value).toBe('PMA 儀表板工作坊');
  expect((screen.getByLabelText('第 2 組名稱') as HTMLInputElement).value).toBe('藍隊');
  expect(screen.getAllByLabelText(/^第 \d 組名稱$/)).toHaveLength(3);
});
