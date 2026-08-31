import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sessionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const pollId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
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
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  await db.exec(readFileSync(new URL('add_live_sessions.sql', import.meta.url), 'utf8'));
}, 20000);

beforeEach(async () => {
  await db.exec('reset role');
  await db.exec('truncate public.live_pulse, public.live_poll_votes; truncate public.live_polls cascade; truncate public.live_sessions cascade;');
  await asOwner(owner, () => db.query(
    "insert into public.live_sessions (id, user_id, title, join_code, status) values ($1, $2, 'Excel 樞紐分析入門', '482910', 'open')",
    [sessionId, owner],
  ));
  await asOwner(owner, () => db.query(
    "insert into public.live_polls (id, session_id, question, options) values ($1, $2, 'SUMIF?', '[\"A\",\"B\",\"C\",\"D\"]'::jsonb)",
    [pollId, sessionId],
  ));
  await asOwner(owner, () => db.query('update public.live_sessions set active_poll_id = $1 where id = $2', [pollId, sessionId]));
});
afterAll(async () => { await db?.close(); });

async function lookupByCode(code = '482910') {
  return asAnon(() => db.query('select * from public.get_live_session_by_code($1)', [code]));
}
async function vote(participantId: string, optionIndex: number, poll = pollId) {
  const result = await asAnon(() => db.query<{ vote_counts: number[]; vote_total: number }>(
    'select * from public.cast_live_poll_vote($1::uuid, $2::uuid, $3)', [poll, participantId, optionIndex],
  ));
  return result.rows[0];
}
async function pulse(participantId: string, value: number, session = sessionId) {
  const result = await asAnon(() => db.query<{ pulse_counts: number[]; pulse_total: number; pulse_average: string }>(
    'select * from public.set_live_pulse($1::uuid, $2::uuid, $3)', [session, participantId, value],
  ));
  return result.rows[0];
}

describe('actual Postgres live-session migration', () => {
  it('resolves a session by its join code with a zero-filled tally', async () => {
    const result = await lookupByCode();
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0] as any;
    expect(row.title).toBe('Excel 樞紐分析入門');
    expect(row.poll_question).toBe('SUMIF?');
    expect(row.vote_counts).toEqual([0, 0, 0, 0]);
    expect(row.pulse_counts).toEqual([0, 0, 0, 0, 0]);
  });

  it('returns no rows for an unknown code', async () => {
    const result = await lookupByCode('000000');
    expect(result.rows).toHaveLength(0);
  });

  it('resolves a session with no active poll yet without erroring', async () => {
    await asOwner(owner, () => db.query('update public.live_sessions set active_poll_id = null where id = $1', [sessionId]));
    const result = await lookupByCode();
    const row = result.rows[0] as any;
    expect(row.poll_question).toBeNull();
    expect(row.vote_counts).toEqual([]);
    expect(row.vote_total).toBe(0);
  });

  it('tallies votes and lets a participant change their vote without double-counting', async () => {
    expect(await vote(participantA, 0)).toEqual({ vote_counts: [1, 0, 0, 0], vote_total: 1 });
    expect(await vote(participantB, 0)).toEqual({ vote_counts: [2, 0, 0, 0], vote_total: 2 });
    expect(await vote(participantA, 2)).toEqual({ vote_counts: [1, 0, 1, 0], vote_total: 2 });
  });

  it('rejects an out-of-range option', async () => {
    await expect(vote(participantA, 4)).rejects.toThrow('INVALID_OPTION');
    await expect(vote(participantA, -1)).rejects.toThrow('INVALID_OPTION');
  });

  it('rejects votes once the session is no longer open', async () => {
    await asOwner(owner, () => db.query("update public.live_sessions set status = 'paused' where id = $1", [sessionId]));
    await expect(vote(participantA, 0)).rejects.toThrow('SESSION_NOT_OPEN');
  });

  it('rejects a vote for a poll that is no longer the active one', async () => {
    const otherPoll = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    await asOwner(owner, () => db.query(
      "insert into public.live_polls (id, session_id, question, options) values ($1, $2, 'old question', '[\"A\",\"B\"]'::jsonb)",
      [otherPoll, sessionId],
    ));
    await expect(vote(participantA, 0, otherPoll)).rejects.toThrow('POLL_NOT_ACTIVE');
  });

  it('summarizes the difficulty pulse and lets a participant update it', async () => {
    expect(await pulse(participantA, 4)).toEqual({ pulse_counts: [0, 0, 0, 1, 0], pulse_total: 1, pulse_average: '4.00' });
    expect(await pulse(participantB, 2)).toEqual({ pulse_counts: [0, 1, 0, 1, 0], pulse_total: 2, pulse_average: '3.00' });
    expect(await pulse(participantA, 5)).toEqual({ pulse_counts: [0, 1, 0, 0, 1], pulse_total: 2, pulse_average: '3.50' });
  });

  it('rejects an out-of-range pulse value', async () => {
    await expect(pulse(participantA, 0)).rejects.toThrow('INVALID_VALUE');
    await expect(pulse(participantA, 6)).rejects.toThrow('INVALID_VALUE');
  });

  it('rejects pulse updates once the session is no longer open', async () => {
    await asOwner(owner, () => db.query("update public.live_sessions set status = 'closed' where id = $1", [sessionId]));
    await expect(pulse(participantA, 3)).rejects.toThrow('SESSION_NOT_OPEN');
  });

  it('keeps sessions and polls owner-scoped under RLS', async () => {
    const ownerRows = await asOwner(owner, () => db.query('select id from public.live_sessions'));
    expect(ownerRows.rows).toHaveLength(1);
    const otherRows = await asOwner(other, () => db.query('select id from public.live_sessions'));
    expect(otherRows.rows).toHaveLength(0);
    await expect(asOwner(other, () => db.query(
      "insert into public.live_polls (id, session_id, question, options) values (gen_random_uuid(), $1, 'x', '[\"A\",\"B\"]'::jsonb)",
      [sessionId],
    ))).rejects.toThrow(/row-level security/);
  });

  it('never lets anon or authenticated bypass the RPCs to read or write votes/pulse directly', async () => {
    await db.exec('set role anon');
    await expect(db.exec('select * from public.live_poll_votes')).rejects.toThrow(/permission denied/);
    await expect(db.exec('select * from public.live_pulse')).rejects.toThrow(/permission denied/);
    await expect(db.exec(`insert into public.live_poll_votes (poll_id, participant_id, option_index) values ('${pollId}', gen_random_uuid(), 0)`)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    await db.exec('set role authenticated');
    await expect(db.exec('select * from public.live_poll_votes')).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
});
