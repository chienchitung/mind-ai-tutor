import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const pid = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const participant = "11111111-1111-4111-8111-111111111111";
let db: PGlite;
async function role<T>(who: string, run: () => Promise<T>) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [who]);
  try {
    return await run();
  } finally {
    await db.exec("reset role");
  }
}
async function command(value: object, who = owner) {
  return role(who, () =>
    db.query("select public.control_live_presentation($1,$2::jsonb) as value", [
      sid,
      JSON.stringify(value),
    ]),
  );
}
async function snapshot() {
  const r = await db.query<{ value: any }>(
    "select public.get_live_presentation('482910') as value",
  );
  return r.rows[0].value;
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
    "scripts/add_live_sessions.sql",
    "scripts/add_live_session_phase2.sql",
    "supabase/migrations/20260904051713_live_presentation_flow.sql",
  ])
    await db.exec(readFileSync(file, "utf8"));
  await db.query(
    "insert into live_sessions(id,user_id,title,join_code) values($1,$2,'Test','482910')",
    [sid, owner],
  );
  await db.query(
    "insert into live_polls(id,session_id,question,options,phase) values($1,$2,'Pick','[\"A\",\"B\"]','draft')",
    [pid, sid],
  );
  await db.query("update live_sessions set active_poll_id=$1 where id=$2", [
    pid,
    sid,
  ]);
}, 20000);
afterAll(async () => {
  await db?.close();
});
describe("presentation state and database enforcement", () => {
  it("rejects other teachers and anonymous controls", async () => {
    await expect(
      command({ action: "show", mode: "blank" }, other),
    ).rejects.toThrow("NOT_FOUND");
    await db.exec("set role anon");
    try {
      await expect(
        db.query("select public.control_live_presentation($1,$2)", [
          sid,
          '{"action":"show","mode":"blank"}',
        ]),
      ).rejects.toThrow("permission denied");
    } finally {
      await db.exec("reset role");
    }
  });
  it("persists display mode for refresh, and enforces each poll phase while Q&A stays open", async () => {
    const vote = () =>
      db.query("select * from cast_live_poll_vote($1,$2,0)", [
        pid,
        participant,
      ]);
    await expect(vote()).rejects.toThrow("POLL_NOT_OPEN");
    await command({ action: "show", mode: "poll" });
    expect((await snapshot()).mode).toBe("poll");
    await expect(
      command({ action: "phase", pollId: pid, phase: "results" }),
    ).rejects.toThrow("INVALID_TRANSITION");
    await command({ action: "phase", pollId: pid, phase: "open" });
    await vote();
    await command({ action: "phase", pollId: pid, phase: "closed" });
    await expect(vote()).rejects.toThrow("POLL_NOT_OPEN");
    const closed = await snapshot();
    expect(closed.poll.voteCounts).toEqual([]);
    expect(closed.poll.voteTotal).toBe(1);
    expect(closed.status).toBe("open");
    await db.query(
      "select * from submit_live_question($1,$2,'Still can ask','clarify')",
      [sid, participant],
    );
    await command({ action: "phase", pollId: pid, phase: "results" });
    expect((await snapshot()).poll.voteCounts).toEqual([1, 0]);
  });
  it("pins selected questions, excludes private/answered questions and does not reorder on upvotes", async () => {
    const a = await db.query<{ id: string }>(
      "insert into live_questions(session_id,participant_id,text,lens,visibility) values($1,$2,'Public','clarify','public') returning id",
      [sid, participant],
    );
    const b = await db.query<{ id: string }>(
      "insert into live_questions(session_id,participant_id,text,lens,visibility) values($1,$2,'Private','clarify','author_only') returning id",
      [sid, participant],
    );
    await expect(
      command({ action: "show", mode: "question", questionId: b.rows[0].id }),
    ).rejects.toThrow("QUESTION_NOT_PUBLIC");
    await command({
      action: "show",
      mode: "question",
      questionId: a.rows[0].id,
    });
    expect((await snapshot()).questions.map((q: any) => q.text)).toEqual([
      "Public",
    ]);
    await command({ action: "show", mode: "questions" });
    const order = (await snapshot()).questions.map((q: any) => q.id);
    await db.query("update live_questions set upvotes=500 where id=$1", [
      a.rows[0].id,
    ]);
    expect((await snapshot()).questions.map((q: any) => q.id)).toEqual(order);
    await command({
      action: "answer",
      questionId: a.rows[0].id,
      answered: true,
    });
    expect(
      (await snapshot()).questions.some((q: any) => q.id === a.rows[0].id),
    ).toBe(false);
    await db.query(
      "update live_questions set visibility='author_only' where session_id=$1",
      [sid],
    );
    expect((await snapshot()).questions).toEqual([]);
  });
  it("rejects stale poll commands and controls after the session ends", async () => {
    await expect(
      command({ action: "phase", pollId: other, phase: "open" }),
    ).rejects.toThrow("POLL_NOT_ACTIVE");
    await db.query("update live_sessions set status='closed' where id=$1", [
      sid,
    ]);
    expect((await snapshot()).status).toBe("closed");
    await expect(command({ action: "show", mode: "blank" })).rejects.toThrow(
      "SESSION_CLOSED",
    );
  });
});
