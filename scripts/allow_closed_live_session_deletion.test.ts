import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sessionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const participantA = "11111111-1111-4111-8111-111111111111";
const participantB = "22222222-2222-4222-8222-222222222222";
let db: PGlite;

async function asOwner<T>(uid: string, run: () => Promise<T>): Promise<T> {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    uid,
  ]);
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}
async function asAnon<T>(run: () => Promise<T>): Promise<T> {
  await db.exec("set role anon");
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
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
  await db.exec(
    readFileSync(new URL("add_live_sessions.sql", import.meta.url), "utf8"),
  );
  await db.exec(
    readFileSync(
      new URL("add_live_session_phase2.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL("allow_closed_live_session_deletion.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    "grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
  );
}, 20000);

beforeEach(async () => {
  await db.exec("reset role");
  await db.exec(
    "truncate public.live_question_votes, public.live_questions; truncate public.live_sessions cascade;",
  );
  await asOwner(owner, () =>
    db.query(
      "insert into public.live_sessions (id, user_id, title, join_code, status) values ($1, $2, 'Excel 樞紐分析入門', '482910', 'open')",
      [sessionId, owner],
    ),
  );
});
afterAll(async () => {
  await db?.close();
});

describe("closed session deletion in PostgreSQL", () => {
  it("denies anonymous deletion", async () => {
    await expect(
      asAnon(() =>
        db.query("delete from public.live_sessions where id = $1", [sessionId]),
      ),
    ).rejects.toThrow();
  });
  it("blocks deletion of open and paused sessions even by their owner", async () => {
    for (const status of ["open", "paused"]) {
      await db.query("update public.live_sessions set status=$1 where id=$2", [
        status,
        sessionId,
      ]);
      const result = await asOwner(owner, () =>
        db.query("delete from public.live_sessions where id=$1 returning id", [
          sessionId,
        ]),
      );
      expect(result.rows).toEqual([]);
    }
  });
  it("blocks another teacher from deleting a closed session", async () => {
    await db.query(
      "update public.live_sessions set status='closed' where id=$1",
      [sessionId],
    );
    const result = await asOwner(other, () =>
      db.query("delete from public.live_sessions where id=$1 returning id", [
        sessionId,
      ]),
    );
    expect(result.rows).toEqual([]);
    expect(
      (await db.query("select id from public.live_sessions")).rows,
    ).toHaveLength(1);
  });
  it("deletes every related record but preserves a different session", async () => {
    const poll = (
      await db.query<{ id: string }>(
        "insert into public.live_polls(session_id, question, options) values ($1, 'Q?', '[\"A\",\"B\"]') returning id",
        [sessionId],
      )
    ).rows[0].id;
    await db.query(
      "update public.live_sessions set active_poll_id=$1 where id=$2",
      [poll, sessionId],
    );
    await db.query(
      "insert into public.live_poll_votes(poll_id, participant_id, option_index) values($1,$2,0)",
      [poll, participantA],
    );
    await db.query(
      "insert into public.live_pulse(session_id, participant_id, value) values($1,$2,3)",
      [sessionId, participantA],
    );
    const question = (
      await db.query<{ id: string }>(
        "insert into public.live_questions(session_id,participant_id,text,lens) values($1,$2,'Question','clarify') returning id",
        [sessionId, participantA],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.live_question_votes(question_id,participant_id) values($1,$2)",
      [question, participantB],
    );
    await db.query(
      "insert into public.live_sessions(user_id,title,join_code) values($1,'Keep me','999999')",
      [owner],
    );
    await db.query(
      "update public.live_sessions set status='closed' where id=$1",
      [sessionId],
    );
    expect(
      (
        await asOwner(owner, () =>
          db.query(
            "delete from public.live_sessions where id=$1 returning id",
            [sessionId],
          ),
        )
      ).rows,
    ).toHaveLength(1);
    for (const table of [
      "live_polls",
      "live_poll_votes",
      "live_pulse",
      "live_questions",
      "live_question_votes",
    ]) {
      expect((await db.query(`select * from public.${table}`)).rows).toEqual(
        [],
      );
    }
    expect(
      (await db.query("select title from public.live_sessions")).rows,
    ).toEqual([{ title: "Keep me" }]);
  });
});
