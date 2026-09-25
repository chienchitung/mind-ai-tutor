import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const teacherId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const classroomId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const gameId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const assignmentId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create table public.students (
      id uuid primary key,
      user_id uuid not null,
      name text not null,
      email text not null,
      grade integer,
      subjects text[] not null default '{}',
      status text not null default 'active',
      last_login timestamptz,
      login_code text unique
    );
    create table public.classrooms (
      id uuid primary key,
      user_id uuid not null,
      name text not null,
      status text not null default 'active'
    );
    create table public.classroom_students (
      classroom_id uuid not null references public.classrooms(id) on delete cascade,
      student_id uuid not null references public.students(id) on delete cascade,
      user_id uuid not null,
      joined_at timestamptz not null default now(),
      left_at timestamptz,
      primary key (classroom_id, student_id)
    );
    create table public.game_assignments (
      id uuid primary key,
      user_id uuid not null,
      classroom_id uuid not null references public.classrooms(id) on delete cascade,
      game_id uuid not null,
      status text not null default 'active',
      assigned_at timestamptz not null default now()
    );
    create function public.verify_student_game_login_code(text, uuid, uuid default null)
    returns table (student_id uuid, student_name text, grade integer, classroom_name text, game_assignment_id uuid, assignment_count integer)
    language sql as $$ select null::uuid, null::text, null::integer, null::text, null::uuid, 0 where false $$;
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/20260925051705_simplify_student_access.sql', import.meta.url), 'utf8'));
  await db.query(
    `insert into public.students (id, user_id, name, email, external_id, grade, login_code)
     values ($1, $2, '王小明', null, 'A001', 10, 'ABCDEFGH')`,
    [studentId, teacherId],
  );
  await db.query(
    `insert into public.classrooms (id, user_id, name) values ($1, $2, '實驗 A 班')`,
    [classroomId, teacherId],
  );
  await db.query(
    `insert into public.classroom_students (classroom_id, student_id, user_id) values ($1, $2, $3)`,
    [classroomId, studentId, teacherId],
  );
  await db.query(
    `insert into public.game_assignments (id, user_id, classroom_id, game_id) values ($1, $2, $3, $4)`,
    [assignmentId, teacherId, classroomId, gameId],
  );
}, 30_000);

afterAll(async () => { await db?.close(); });

describe('account-free classroom access migration', () => {
  it('accepts a roster identifier only for its exact active assignment', async () => {
    await db.exec('set role anon');
    const result = await db.query<{
      student_id: string;
      student_name: string;
      student_display_name: string;
      classroom_name: string;
      game_assignment_id: string;
    }>(
      'select * from public.verify_student_game_login_code($1, $2::uuid, $3::uuid)',
      [' a001 ', gameId, assignmentId],
    );
    expect(result.rows).toEqual([expect.objectContaining({
      student_id: studentId,
      student_name: '王○○',
      student_display_name: '王○○',
      classroom_name: '實驗 A 班',
      game_assignment_id: assignmentId,
    })]);
  });

  it('does not expose roster identifiers through a generic game URL', async () => {
    await db.exec('set role anon');
    const result = await db.query(
      'select * from public.verify_student_game_login_code($1, $2::uuid, null)',
      ['A001', gameId],
    );
    expect(result.rows).toHaveLength(0);
  });

  it('keeps the eight-character fallback code working on a generic game URL', async () => {
    await db.exec('set role anon');
    const result = await db.query<{ student_id: string; assignment_count: number }>(
      'select student_id, assignment_count from public.verify_student_game_login_code($1, $2::uuid, null)',
      ['ABCDEFGH', gameId],
    );
    expect(result.rows).toEqual([{ student_id: studentId, assignment_count: 1 }]);
  });

  it('blocks student-ID access as soon as the classroom is archived', async () => {
    await db.exec('reset role');
    await db.query(`update public.classrooms set status = 'archived' where id = $1`, [classroomId]);
    await db.exec('set role anon');
    const result = await db.query(
      'select * from public.verify_student_game_login_code($1, $2::uuid, $3::uuid)',
      ['A001', gameId, assignmentId],
    );
    expect(result.rows).toHaveLength(0);
  });
});
