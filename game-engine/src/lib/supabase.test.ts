import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc }),
}));

vi.mock('uuid', () => ({ v4: vi.fn(() => 'test-id') }));

import { saveLearningRecord, verifyStudentLoginCode } from './supabase';

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
