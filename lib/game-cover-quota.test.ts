import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';

const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${user}'), ('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  await db.exec(readFileSync(new URL('../scripts/add_game_cover_ai_quota.sql', import.meta.url), 'utf8'));
}, 20000);
beforeEach(async () => {
  await db.exec('reset role; truncate public.game_cover_ai_usage;');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
});
afterAll(async () => { await db?.close(); });
async function claim(requestId = crypto.randomUUID()) {
  const result = await db.query<{ result: string }>('select public.claim_game_cover_generation($1::uuid) as result', [requestId]);
  return result.rows[0].result;
}
describe('actual Postgres quota migration', () => {
  it('works for an authenticated user without exposing the usage table', async () => {
    await db.exec('set role authenticated');
    expect(await claim()).toBe('OK');
    await expect(db.exec('select * from public.game_cover_ai_usage')).rejects.toThrow(/permission denied/);
    await expect(db.exec('update public.game_cover_ai_usage set attempts=0')).rejects.toThrow(/permission denied/);
  });
  it('denies anonymous execution and absent identities', async () => {
    await db.exec('set role anon');
    await expect(claim()).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await expect(claim()).rejects.toThrow('UNAUTHORIZED');
  });
  it('does not charge the same request twice and prevents bursts', async () => {
    const id = crypto.randomUUID();
    expect(await claim(id)).toBe('OK');
    expect(await claim(id)).toBe('DUPLICATE');
    expect(await claim()).toBe('COOLDOWN');
    const row = await db.query<{ attempts: number }>('select attempts from public.game_cover_ai_usage');
    expect(row.rows[0].attempts).toBe(1);
  });
  it('limits attempts to five per Taipei calendar day, then resets on the next day', async () => {
    for (let i = 0; i < 5; i++) {
      await db.exec("update public.game_cover_ai_usage set last_attempt=now()-interval '61 seconds'");
      expect(await claim()).toBe('OK');
    }
    await db.exec("update public.game_cover_ai_usage set last_attempt=now()-interval '61 seconds'");
    expect(await claim()).toBe('DAILY_LIMIT');
    await db.exec("update public.game_cover_ai_usage set usage_day=usage_day-1");
    expect(await claim()).toBe('OK');
    const row = await db.query<{ attempts: number }>('select attempts from public.game_cover_ai_usage');
    expect(row.rows[0].attempts).toBe(1);
  });
  it('keeps quotas separate for each verified identity', async () => {
    expect(await claim()).toBe('OK');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
    expect(await claim()).toBe('OK');
    const result = await db.query('select user_id from public.game_cover_ai_usage');
    expect(result.rows).toHaveLength(2);
  });
  it('serializes closely spaced requests instead of granting both', async () => {
    expect(await Promise.all([claim(), claim()])).toEqual(['OK', 'COOLDOWN']);
  });
});
