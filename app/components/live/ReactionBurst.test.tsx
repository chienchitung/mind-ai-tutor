// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ReactionBurstOverlay, useReactionBursts } from './ReactionBurst';

function Harness({ onPush }: { onPush: (push: (kind: string) => void) => void }) {
  const { reactions, push } = useReactionBursts();
  onPush(push);
  return <ReactionBurstOverlay reactions={reactions} />;
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useReactionBursts / ReactionBurstOverlay', () => {
  it('renders a pushed reaction as a floating emoji, then removes it after its lifetime', () => {
    let push!: (kind: string) => void;
    const { container } = render(<Harness onPush={(p) => { push = p; }} />);
    act(() => push('applause'));
    expect(container.textContent).toContain('👏');
    act(() => { vi.advanceTimersByTime(2600); });
    expect(container.textContent).not.toContain('👏');
  });
  it('supports multiple concurrent reactions independently', () => {
    let push!: (kind: string) => void;
    const { container } = render(<Harness onPush={(p) => { push = p; }} />);
    act(() => { push('applause'); push('insight'); });
    expect(container.textContent).toContain('👏');
    expect(container.textContent).toContain('💡');
  });
  it('falls back to a generic emoji for an unknown reaction kind', () => {
    let push!: (kind: string) => void;
    const { container } = render(<Harness onPush={(p) => { push = p; }} />);
    act(() => push('unknown-kind'));
    expect(container.textContent).toContain('👍');
  });
});
