import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const quizId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const questions = [
  { id: 'q1', questionText: 'Which function sums a range?', options: [{ id: 'a', text: 'SUM' }, { id: 'b', text: 'AVG' }], questionType: 'single', correctAnswer: 'a', explanation: 'SUM adds values.' },
  { id: 'q2', questionText: 'Pick every valid chart type', options: [{ id: 'a', text: 'Bar' }, { id: 'b', text: 'Line' }, { id: 'c', text: 'Pie' }], questionType: 'multiple', correctAnswer: ['a', 'b'], explanation: 'Bar and Line.' },
];
let db: PGlite;

async function asOwner<T>(run: () => Promise<T>): Promise<T> {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
  try { return await run(); } finally { await db.exec('reset role'); }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'), ('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  await db.exec(readFileSync(new URL('add_ai_quizzes.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('add_ai_quiz_sharing.sql', import.meta.url), 'utf8'));
}, 20000);

beforeEach(async () => {
  await db.exec('reset role');
  await db.exec('truncate public.ai_quiz_attempts; truncate public.ai_quizzes cascade;');
  await asOwner(() => db.query(
    "insert into public.ai_quizzes (id, user_id, title, questions, is_public) values ($1, $2, 'Excel basics', $3, false)",
    [quizId, owner, JSON.stringify(questions)],
  ));
});
afterAll(async () => { await db?.close(); });

async function getPublicQuiz(id = quizId) {
  await db.exec('set role anon');
  try { return await db.query('select * from public.get_public_quiz($1::uuid)', [id]); }
  finally { await db.exec('reset role'); }
}
async function submit(answers: Record<string, unknown>, name = 'Alex', id = quizId) {
  await db.exec('set role anon');
  try {
    const result = await db.query<{ score: number; total: number }>(
      'select * from public.submit_public_quiz_attempt($1::uuid, $2, $3::jsonb)',
      [id, name, JSON.stringify(answers)],
    );
    return result.rows[0];
  } finally { await db.exec('reset role'); }
}

describe('actual Postgres quiz sharing migration', () => {
  it('hides an unshared quiz from the public function', async () => {
    const result = await getPublicQuiz();
    expect(result.rows).toHaveLength(0);
  });

  it('strips the answer key from a shared quiz', async () => {
    await asOwner(() => db.query('update public.ai_quizzes set is_public = true where id = $1', [quizId]));
    const result = await getPublicQuiz();
    expect(result.rows).toHaveLength(1);
    const [row] = result.rows as Array<{ title: string; questions: unknown }>;
    expect(row.title).toBe('Excel basics');
    const publicQuestions = row.questions as Array<Record<string, unknown>>;
    expect(publicQuestions).toHaveLength(2);
    for (const question of publicQuestions) {
      expect(question).not.toHaveProperty('correctAnswer');
      expect(question).not.toHaveProperty('explanation');
    }
  });

  it('rejects submissions to a quiz that is not shared', async () => {
    await expect(submit({ q1: 'a' })).rejects.toThrow('QUIZ_NOT_FOUND');
  });

  it('rejects an empty or oversized student name', async () => {
    await asOwner(() => db.query('update public.ai_quizzes set is_public = true where id = $1', [quizId]));
    await expect(submit({ q1: 'a' }, '  ')).rejects.toThrow('INVALID_NAME');
    await expect(submit({ q1: 'a' }, 'x'.repeat(101))).rejects.toThrow('INVALID_NAME');
  });

  it('scores single- and multiple-answer questions server-side, ignoring a client-implied score', async () => {
    await asOwner(() => db.query('update public.ai_quizzes set is_public = true where id = $1', [quizId]));
    expect(await submit({ q1: 'a', q2: ['a', 'b'] })).toEqual({ score: 2, total: 2 });
    expect(await submit({ q1: 'b', q2: ['a'] })).toEqual({ score: 0, total: 2 });
    // Extra/duplicate selections must not count as a correct multi-answer match.
    expect(await submit({ q1: 'a', q2: ['a', 'b', 'c'] })).toEqual({ score: 1, total: 2 });
  });

  it('records the attempt and lets only the owning teacher read it back', async () => {
    await asOwner(() => db.query('update public.ai_quizzes set is_public = true where id = $1', [quizId]));
    await submit({ q1: 'a', q2: ['a', 'b'] });

    const ownerRows = await asOwner(() => db.query('select student_name, score, total from public.ai_quiz_attempts where quiz_id = $1', [quizId]));
    expect(ownerRows.rows).toEqual([{ student_name: 'Alex', score: 2, total: 2 }]);

    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
    const otherRows = await db.query('select * from public.ai_quiz_attempts where quiz_id = $1', [quizId]);
    await db.exec('reset role');
    expect(otherRows.rows).toHaveLength(0);
  });

  it('never lets anonymous or authenticated roles bypass the RPC to write attempts directly', async () => {
    const insertSql = `insert into public.ai_quiz_attempts (quiz_id, student_name, score, total) values ('${quizId}', 'x', 5, 5)`;
    await db.exec('set role anon');
    await expect(db.exec('select * from public.ai_quiz_attempts')).rejects.toThrow(/permission denied/);
    await expect(db.exec(insertSql)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    // authenticated has a SELECT grant (RLS still limits it to owned quizzes,
    // covered by the previous test) but no INSERT grant at all - direct
    // writes must go through submit_public_quiz_attempt, never the table.
    await db.exec('set role authenticated');
    await expect(db.exec(insertSql)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
});
