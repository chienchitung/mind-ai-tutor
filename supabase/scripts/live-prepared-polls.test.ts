import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);insert into auth.users values('${owner}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  for (const file of ["supabase/scripts/add_live_sessions.sql", "supabase/migrations/20261122060000_live_prepared_polls.sql"])
    await db.exec(readFileSync(file, "utf8"));
  await db.query("insert into live_sessions(id,user_id,title,join_code) values($1,$2,'Mine','482910')", [sid, owner]);
}, 20000);
afterAll(async () => { await db?.close(); });

it("starts empty, holds a list of up to 30, and is not readable by students", async () => {
  expect((await db.query("select prepared_polls from live_sessions")).rows).toEqual([{ prepared_polls: [] }]);
  const list = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: String(i), question: "Q", options: ["A", "B"] })));
  await db.query("update live_sessions set prepared_polls=$1::jsonb", [list(30)]);
  await expect(db.query("update live_sessions set prepared_polls=$1::jsonb", [list(31)])).rejects.toThrow("prepared_polls_shape");
  await expect(db.query("update live_sessions set prepared_polls='{}'::jsonb")).rejects.toThrow("prepared_polls_shape");
  await db.exec("set role anon");
  try {
    await expect(db.query("select prepared_polls from live_sessions")).rejects.toThrow("permission denied");
  } finally { await db.exec("reset role"); }
});
