// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { JOIN_BAR_KEY, useJoinBarHidden } from './useJoinBarHidden';

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

it('remembers the choice and follows a change made in another window', () => {
  const { result } = renderHook(() => useJoinBarHidden());
  expect(result.current[0]).toBe(false);
  act(() => result.current[1](true));
  expect(result.current[0]).toBe(true);
  expect(values.get(JOIN_BAR_KEY)).toBe('1');

  // The presenter page shows it again: the projector window hears about it.
  values.set(JOIN_BAR_KEY, '0');
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: JOIN_BAR_KEY })); });
  expect(result.current[0]).toBe(false);
  // Other keys are ignored.
  values.set(JOIN_BAR_KEY, '1');
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' })); });
  expect(result.current[0]).toBe(false);
});

it('starts hidden when it was hidden before', () => {
  values.set(JOIN_BAR_KEY, '1');
  const { result } = renderHook(() => useJoinBarHidden());
  expect(result.current[0]).toBe(true);
});

it('keeps every user of the switch in the same window in step', () => {
  // e.g. the projector toolbar and the projector page around it, or the
  // presenter's switch and its own single-screen stage.
  const first = renderHook(() => useJoinBarHidden());
  const second = renderHook(() => useJoinBarHidden());
  act(() => first.result.current[1](true));
  expect(second.result.current[0]).toBe(true);
  act(() => second.result.current[1](false));
  expect(first.result.current[0]).toBe(false);
});
