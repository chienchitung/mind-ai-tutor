import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherSid = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
let db: PGlite;

async function as<T>(who: string, run: () => Promise<T>) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [who]);
  try { return await run(); } finally { await db.exec("reset role"); }
}
const clear = (questions: boolean, pulse: boolean, who = owner, session = sid) =>
  as(who, () => db.query("select public.clear_live_session_activity($1,$2,$3)", [session, questions, pulse]));
const count = async (sql: string, session = sid) =>
  Number((await db.query<{ n: number }>(`select count(*)::int as n from ${sql} where session_id=$1`, [session])).rows[0].n);

async function seed(session: string) {
  for (const participant of [a, b]) {
    await db.query("select * from public.submit_live_question($1,$2,'為什麼？','clarify')", [session, participant]);
    await db.query("select * from public.set_live_pulse($1,$2,3)", [session, participant]);
  }
  const { rows } = await db.query<{ id: string }>("select id from public.live_questions where session_id=$1 limit 1", [session]);
  await db.query("select * from public.upvote_live_question($1,$2)", [rows[0].id, b]);
}

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
    "supabase/migrations/20261113020000_live_clear_activity.sql",
  ]) await db.exec(readFileSync(file, "utf8"));
  await db.query("insert into live_sessions(id,user_id,title,join_code,status) values($1,$2,'Mine','482910','open'),($3,$4,'Theirs','111111','open')", [sid, owner, otherSid, other]);
  await seed(sid);
  await seed(otherSid);
}, 20000);
afterAll(async () => { await db?.close(); });

it("refuses anyone but the session's teacher", async () => {
  await expect(clear(true, true, other)).rejects.toThrow("FORBIDDEN");
  await db.exec("set role anon");
  try {
    await expect(db.query("select public.clear_live_session_activity($1,true,true)", [sid])).rejects.toThrow("permission denied");
  } finally { await db.exec("reset role"); }
  expect(await count("public.live_questions")).toBe(2);
});

it("clears only what was asked, only for this session, and leaves the projection on the slides", async () => {
  await db.query("update live_sessions set presentation='{\"mode\":\"questions\",\"questionIds\":[]}' where id=$1", [sid]);
  await clear(false, true);
  expect(await count("public.live_pulse")).toBe(0);
  expect(await count("public.live_questions")).toBe(2);

  await clear(true, false);
  expect(await count("public.live_questions")).toBe(0);
  expect((await db.query("select count(*)::int as n from public.live_question_votes")).rows[0]).toEqual({ n: 1 });
  const { rows } = await db.query<{ presentation: { mode: string } }>("select presentation from live_sessions where id=$1", [sid]);
  expect(rows[0].presentation.mode).toBe("deck");

  expect(await count("public.live_questions", otherSid)).toBe(2);
  expect(await count("public.live_pulse", otherSid)).toBe(2);
});
