import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);insert into auth.users values('${owner}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  for (const file of ["supabase/scripts/add_live_sessions.sql", "supabase/migrations/20261122100000_live_class_timer.sql"])
    await db.exec(readFileSync(file, "utf8"));
  await db.query(
    "insert into live_sessions(id,user_id,title,join_code,timer) values(gen_random_uuid(),$1,'Mine','482910',$2::jsonb)",
    [owner, JSON.stringify({ durationSeconds: 300, remainingSeconds: 300, endsAt: null })],
  );
}, 20000);
afterAll(async () => { await db?.close(); });

it("lets a student read the class timer by code, and nothing else of the session", async () => {
  await db.exec("set role anon");
  try {
    const { rows } = await db.query<{ t: unknown }>("select public.get_live_timer('482910') as t");
    expect(rows[0].t).toEqual({ durationSeconds: 300, remainingSeconds: 300, endsAt: null });
    expect((await db.query<{ t: unknown }>("select public.get_live_timer('000000') as t")).rows[0].t).toBeNull();
    await expect(db.query("select timer from live_sessions")).rejects.toThrow("permission denied");
  } finally { await db.exec("reset role"); }
});
