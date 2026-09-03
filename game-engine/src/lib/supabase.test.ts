import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc, from }),
}));

vi.mock('uuid', () => ({ v4: vi.fn(() => 'test-id') }));

import { saveLearningRecord, saveGuestPlayStats, verifyStudentLoginCode } from './supabase';

describe('verifyStudentLoginCode', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('trims the teacher code and returns the verified roster identity', async () => {
    rpc.mockResolvedValue({
      data: [{ student_id: 'student-uuid', student_name: '小明', grade: 5 }],
      error: null,
    });

    await expect(verifyStudentLoginCode('  HPGZR92P  ')).resolves.toEqual({
      student_id: 'student-uuid',
      student_name: '小明',
      grade: 5,
    });
    expect(rpc).toHaveBeenCalledWith('verify_student_login_code', {
      p_code: 'HPGZR92P',
    });
  });

  it('does not call the database for an empty code', async () => {
    await expect(verifyStudentLoginCode('   ')).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { data: [], error: null },
    { data: [{ student_id: null, student_name: null, grade: null }], error: null },
    { data: [{ student_id: 'student-uuid', student_name: '   ', grade: null }], error: null },
  ])('rejects an unknown or malformed RPC response', async (result) => {
    rpc.mockResolvedValue(result);
    await expect(verifyStudentLoginCode('UNKNOWN1')).resolves.toBeNull();
  });

  it('returns null when the RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(verifyStudentLoginCode('HPGZR92P')).resolves.toBeNull();
  });
});

describe('guest data minimization', () => {
  it('does not persist a learning record without a teacher-linked roster id', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null) });
    await expect(saveLearningRecord({
      student_id: 'guest-random',
      student_name: '訪客玩家',
      lesson_id: 'lesson-1',
      started_at: new Date(0).toISOString(),
      completed_at: new Date(1_000).toISOString(),
      time_spent_seconds: 1,
      answer_attempts: 1,
      game_id: 'game-1',
    })).resolves.toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe('saveGuestPlayStats', () => {
  beforeEach(() => {
    from.mockReset();
  });

  it('records anonymous guest play with no name or student id', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null) });
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    from.mockReturnValue({ insert });

    await saveGuestPlayStats({
      game_id: 'game-1',
      lesson_id: 'lesson-1',
      started_at: new Date(0).toISOString(),
      completed_at: new Date(1_000).toISOString(),
      time_spent_seconds: 1,
      answer_attempts: 2,
      is_final_lesson: true,
    });

    expect(from).toHaveBeenCalledWith('guest_play_stats');
    const [rows] = insert.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      game_id: 'game-1',
      lesson_id: 'lesson-1',
      time_spent_seconds: 1,
      answer_attempts: 2,
      is_final_lesson: true,
    });
    expect(rows[0]).not.toHaveProperty('student_id');
    expect(rows[0]).not.toHaveProperty('student_name');
    vi.unstubAllGlobals();
  });

  it('does nothing once a teacher login code has linked this browser', async () => {
    // getStoredStudentRefId's own window guard (window === undefined in this
    // node test environment) would otherwise make it look "unlinked" no
    // matter what localStorage returns - stub window too so this test
    // actually reaches the localStorage.getItem() call it's exercising.
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'linked-ref-id') });
    const insert = vi.fn();
    from.mockReturnValue({ insert });

    await saveGuestPlayStats({
      game_id: 'game-1',
      lesson_id: 'lesson-1',
      started_at: new Date(0).toISOString(),
      completed_at: new Date(1_000).toISOString(),
      time_spent_seconds: 1,
      answer_attempts: 1,
    });

    expect(insert).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does nothing without a game_id', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null) });
    const insert = vi.fn();
    from.mockReturnValue({ insert });

    await saveGuestPlayStats({
      game_id: '',
      lesson_id: 'lesson-1',
      started_at: new Date(0).toISOString(),
      completed_at: new Date(1_000).toISOString(),
      time_spent_seconds: 1,
      answer_attempts: 1,
    });

    expect(insert).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
