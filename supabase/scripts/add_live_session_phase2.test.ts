import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sessionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const participantA = '11111111-1111-4111-8111-111111111111';
const participantB = '22222222-2222-4222-8222-222222222222';
let db: PGlite;

async function asOwner<T>(uid: string, run: () => Promise<T>): Promise<T> {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  try { return await run(); } finally { await db.exec('reset role'); }
}
async function asAnon<T>(run: () => Promise<T>): Promise<T> {
  await db.exec('set role anon');
  try { return await run(); } finally { await db.exec('reset role'); }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'), ('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    -- Minimal stand-in for Supabase's storage extension, just enough for
    -- this migration's bucket insert and storage.objects RLS policies to run.
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    alter table storage.objects enable row level security;`);
  await db.exec(readFileSync(new URL('add_live_sessions.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('add_live_session_phase2.sql', import.meta.url), 'utf8'));
}, 20000);

beforeEach(async () => {
  await db.exec('reset role');
  await db.exec('truncate public.live_question_votes, public.live_questions; truncate public.live_sessions cascade;');
  await asOwner(owner, () => db.query(
    "insert into public.live_sessions (id, user_id, title, join_code, status) values ($1, $2, 'Excel 樞紐分析入門', '482910', 'open')",
    [sessionId, owner],
  ));
});
afterAll(async () => { await db?.close(); });

async function submit(text: string, participantId = participantA, lens = 'clarify', session = sessionId) {
  return asAnon(() => db.query(
    'select * from public.submit_live_question($1::uuid, $2::uuid, $3, $4)',
    [session, participantId, text, lens],
  ));
}
async function upvote(questionId: string, participantId: string) {
  return asAnon(() => db.query('select * from public.upvote_live_question($1::uuid, $2::uuid)', [questionId, participantId]));
}
async function publicList(participantId: string | null = null) {
  return asAnon(() => db.query('select * from public.get_live_questions($1::uuid, $2::uuid)', [sessionId, participantId]));
}
async function moderate(uid: string, questionId: string, visibility: string) {
  return asOwner(uid, () => db.query('select * from public.moderate_live_question($1::uuid, $2)', [questionId, visibility]));
}

describe('actual Postgres live-session Q&A migration', () => {
  it('accepts a submission and returns it as public by default', async () => {
    const result = await submit('這題可以再講一次嗎？');
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0] as any;
    expect(row.visibility).toBe('public');
    expect(row.upvotes).toBe(0);
  });

  it('rejects an unsupported lens and an empty question', async () => {
    await expect(submit('x', participantA, 'bogus')).rejects.toThrow('INVALID_LENS');
    await expect(submit('   ')).rejects.toThrow('INVALID_TEXT');
  });

  it('rejects submissions once the session is no longer open', async () => {
    await asOwner(owner, () => db.query("update public.live_sessions set status = 'closed' where id = $1", [sessionId]));
    await expect(submit('太晚了')).rejects.toThrow('SESSION_NOT_OPEN');
  });

  it('tallies upvotes and ignores a repeat upvote from the same participant', async () => {
    const created = await submit('這題可以再講一次嗎？');
    const id = (created.rows[0] as any).id;
    expect((await upvote(id, participantA)).rows[0]).toEqual({ upvotes: 1 });
    expect((await upvote(id, participantB)).rows[0]).toEqual({ upvotes: 2 });
    expect((await upvote(id, participantA)).rows[0]).toEqual({ upvotes: 2 });
  });

  it('hides a moderated question from the public list but still shows it to its author', async () => {
    const created = await submit('這是敏感問題', participantA);
    const id = (created.rows[0] as any).id;
    await moderate(owner, id, 'author_only');

    const publicRows = await publicList(participantB);
    expect(publicRows.rows).toHaveLength(0);

    const authorRows = await publicList(participantA);
    expect(authorRows.rows).toHaveLength(1);
    expect((authorRows.rows[0] as any).is_mine).toBe(true);
  });

  it('lets only the owning teacher moderate a question', async () => {
    const created = await submit('x');
    const id = (created.rows[0] as any).id;
    await expect(moderate(other, id, 'author_only')).rejects.toThrow('FORBIDDEN');
  });

  it('lets the owner see every question including hidden ones', async () => {
    const created = await submit('x');
    const id = (created.rows[0] as any).id;
    await moderate(owner, id, 'author_only');
    const rows = await asOwner(owner, () => db.query('select * from public.get_live_questions_for_owner($1::uuid)', [sessionId]));
    expect(rows.rows).toHaveLength(1);
  });

  it('never lets anon or authenticated bypass the RPCs to read or write questions directly', async () => {
    await db.exec('set role anon');
    await expect(db.exec('select * from public.live_questions')).rejects.toThrow(/permission denied/);
    await expect(db.exec(`insert into public.live_questions (session_id, participant_id, text, lens) values ('${sessionId}', gen_random_uuid(), 'x', 'clarify')`)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });

  it('carries deck_url/deck_page through the reworked get_live_session_by_code', async () => {
    await asOwner(owner, () => db.query(
      "update public.live_sessions set deck_url = 'https://example.test/deck.pdf', deck_page = 3 where id = $1", [sessionId],
    ));
    const result = await asAnon(() => db.query('select * from public.get_live_session_by_code($1)', ['482910']));
    const row = result.rows[0] as any;
    expect(row.deck_url).toBe('https://example.test/deck.pdf');
    expect(row.deck_page).toBe(3);
  });
});
