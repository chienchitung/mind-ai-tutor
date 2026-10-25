// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyFeedback } from './useCopyFeedback';

const writeText = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => vi.useRealTimers());

describe('useCopyFeedback', () => {
  it('confirms every click, and a repeat click restarts the timer', async () => {
    const { result } = renderHook(() => useCopyFeedback(1000));
    await act(() => result.current.copy('a'));
    const first = result.current.tick;
    expect(result.current.isCopied()).toBe(true);

    act(() => { vi.advanceTimersByTime(800); });
    await act(() => result.current.copy('a'));
    // A new tick re-keys the confirmation icon so its animation replays.
    expect(result.current.tick).toBe(first + 1);

    act(() => { vi.advanceTimersByTime(800); });
    expect(result.current.isCopied()).toBe(true);
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.isCopied()).toBe(false);
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('tracks which item was copied', async () => {
    const { result } = renderHook(() => useCopyFeedback());
    await act(() => result.current.copy('x', 'notes'));
    expect(result.current.isCopied('notes')).toBe(true);
    expect(result.current.isCopied('transcript')).toBe(false);
  });

  it('leaves the state alone and rethrows when the clipboard refuses', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useCopyFeedback());
    await expect(act(() => result.current.copy('x'))).rejects.toThrow('denied');
    expect(result.current.isCopied()).toBe(false);
  });
});
