// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useUnsavedChanges } from './useUnsavedChanges';

vi.mock('@/app/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

describe('useUnsavedChanges - browser back/forward', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/lessons');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('arms a guard history entry once when changes become dirty', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const { rerender } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
      initialProps: { dirty: false },
    });
    expect(pushSpy).not.toHaveBeenCalled();

    rerender({ dirty: true });
    expect(pushSpy).toHaveBeenCalledTimes(1);

    // Staying dirty across re-renders shouldn't re-arm the guard.
    rerender({ dirty: true });
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('re-arms the guard on popstate when the user cancels leaving', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const pushSpy = vi.spyOn(window.history, 'pushState');
    renderHook(() => useUnsavedChanges(true));
    expect(pushSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

  it('does not re-arm the guard on popstate when the user confirms leaving', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const pushSpy = vi.spyOn(window.history, 'pushState');
    renderHook(() => useUnsavedChanges(true));
    expect(pushSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('resets the guard once changes are no longer dirty, so it can re-arm later', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const { rerender } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
      initialProps: { dirty: true },
    });
    expect(pushSpy).toHaveBeenCalledTimes(1);

    rerender({ dirty: false });
    rerender({ dirty: true });
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });
});
