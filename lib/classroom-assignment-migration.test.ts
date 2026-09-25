import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const teacherId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const classroomId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const gameId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const firstAssignmentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const duplicateAssignmentId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create table public.game_assignments (
      id uuid primary key,
      user_id uuid not null,
      classroom_id uuid not null,
      game_id uuid not null,
      status text not null default 'active',
      assigned_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await db.query(
    `insert into public.game_assignments
      (id, user_id, classroom_id, game_id, assigned_at, created_at)
     values
      ($1, $3, $4, $5, '2026-01-01', '2026-01-01'),
      ($2, $3, $4, $5, '2026-02-01', '2026-02-01')`,
    [firstAssignmentId, duplicateAssignmentId, teacherId, classroomId, gameId],
  );
  await db.exec(readFileSync(new URL('../supabase/migrations/20260925054927_prevent_duplicate_active_game_assignments.sql', import.meta.url), 'utf8'));
}, 30_000);

afterAll(async () => { await db?.close(); });

describe('classroom game assignment invariant', () => {
  it('keeps the first shared link and closes later accidental duplicates', async () => {
    const result = await db.query<{ id: string; status: string }>(
      `select id, status from public.game_assignments order by assigned_at`,
    );
    expect(result.rows).toEqual([
      { id: firstAssignmentId, status: 'active' },
      { id: duplicateAssignmentId, status: 'archived' },
    ]);
  });

  it('rejects a second active assignment for the same class and game', async () => {
    await expect(db.query(
      `insert into public.game_assignments (id, user_id, classroom_id, game_id)
       values ('ffffffff-ffff-4fff-8fff-ffffffffffff', $1, $2, $3)`,
      [teacherId, classroomId, gameId],
    )).rejects.toThrow(/game_assignments_one_active_game_per_class/);
  });

  it('allows the game to be assigned again after the active link is stopped', async () => {
    await db.query(`update public.game_assignments set status = 'archived' where id = $1`, [firstAssignmentId]);
    await expect(db.query(
      `insert into public.game_assignments (id, user_id, classroom_id, game_id)
       values ('ffffffff-ffff-4fff-8fff-ffffffffffff', $1, $2, $3)`,
      [teacherId, classroomId, gameId],
    )).resolves.toBeDefined();
  });
});
