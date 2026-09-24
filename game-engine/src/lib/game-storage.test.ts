import { afterEach, describe, expect, it, vi } from 'vitest';
import { gameStorageKey } from './game-storage';

describe('gameStorageKey assignment isolation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps legacy game storage unchanged without an assignment', () => {
    vi.stubGlobal('window', { localStorage: { getItem: vi.fn(() => null) } });
    expect(gameStorageKey('game-1', 'progress')).toBe('game:game-1:progress');
  });

  it('isolates progress and identity by assignment while keeping the assignment pointer stable', () => {
    vi.stubGlobal('window', { localStorage: { getItem: vi.fn(() => 'assignment-1') } });
    expect(gameStorageKey('game-1', 'game_assignment_id')).toBe('game:game-1:game_assignment_id');
    expect(gameStorageKey('game-1', 'progress')).toBe('game:game-1:assignment:assignment-1:progress');
    expect(gameStorageKey('game-1', 'student_ref_id')).toBe('game:game-1:assignment:assignment-1:student_ref_id');
  });
});
