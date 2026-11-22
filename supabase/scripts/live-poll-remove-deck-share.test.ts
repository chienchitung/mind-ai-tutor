import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const oldPoll = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const poll = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const student = "11111111-1111-4111-8111-111111111111";
let db: PGlite;

async function as<T>(who: string, run: () => Promise<T>) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [who]);
  try { return await run(); } finally { await db.exec("reset role"); }
}
const remove = (who = owner) => as(who, () => db.query("select public.remove_live_poll($1)", [sid]));
const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
 create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
 alter table storage.objects enable row level security;`);
  for (const file of [
    "supabase/scripts/add_live_sessions.sql",
    "supabase/scripts/add_live_session_phase2.sql",
    "supabase/migrations/20260904051713_live_presentation_flow.sql",
    "supabase/migrations/20261122020000_live_poll_remove_and_deck_share.sql",
  ]) await db.exec(readFileSync(file, "utf8"));
  await db.query("insert into live_sessions(id,user_id,title,join_code,status) values($1,$2,'Mine','482910','open')", [sid, owner]);
  await db.query("insert into live_polls(id,session_id,question,options,phase) values($1,$3,'Old','[\"A\",\"B\"]','closed'),($2,$3,'Now','[\"A\",\"B\"]','open')", [oldPoll, poll, sid]);
  await db.query("update live_sessions set active_poll_id=$1, presentation='{\"mode\":\"poll\"}' where id=$2", [poll, sid]);
  await db.query("select * from public.cast_live_poll_vote($1,$2,0)", [poll, student]);
}, 20000);
afterAll(async () => { await db?.close(); });

it("lets only the session's teacher remove the current poll, with its votes", async () => {
  await expect(remove(other)).rejects.toThrow("FORBIDDEN");
  await db.exec("set role anon");
  try {
    await expect(db.query("select public.remove_live_poll($1)", [sid])).rejects.toThrow("permission denied");
  } finally { await db.exec("reset role"); }

  await remove();
  expect(await one("select active_poll_id, presentation->>'mode' as mode from live_sessions where id=$1", [sid]))
    .toEqual({ active_poll_id: null, mode: "deck" });
  expect(await one("select count(*)::int as n from live_poll_votes")).toEqual({ n: 0 });
  expect((await db.query("select id from live_polls")).rows).toEqual([{ id: oldPoll }]);
  // Nothing left to remove is not an error.
  await remove();
});

it("keeps the slides private after class unless the teacher shares them", async () => {
  const shared = async () => {
    await db.exec("set role anon");
    try { return (await one<{ v: boolean }>("select public.live_session_shares_deck('482910') as v")).v; }
    finally { await db.exec("reset role"); }
  };
  expect(await shared()).toBe(false);
  await db.query("update live_sessions set share_deck_after_close=true where id=$1", [sid]);
  expect(await shared()).toBe(true);
  await db.exec("set role anon");
  try { expect((await one<{ v: boolean }>("select public.live_session_shares_deck('000000') as v")).v).toBe(false); }
  finally { await db.exec("reset role"); }
});
