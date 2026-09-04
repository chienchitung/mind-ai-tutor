import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: { id: "owner" } as { id: string } | null,
  rpc: vi.fn(),
}));
vi.mock("@/app/lib/supabase", () => ({
  getServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/lib/live-broadcast", () => ({
  broadcastLiveUpdate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<any>("next/server");
  return { ...actual, after: vi.fn() };
});
import { POST } from "./route";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const questionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const call = (body: object, origin = "https://test.local") =>
  POST(
    new Request(
      "https://test.local/api/live-sessions/" + id + "/presentation",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", origin },
        body: JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ id }) },
  );
beforeEach(() => {
  mocks.user = { id: "owner" };
  mocks.rpc
    .mockReset()
    .mockResolvedValue({
      data: { mode: "question", questions: [] },
      error: null,
    });
});
describe("presentation API boundary", () => {
  it("rejects unsupported display size and sorting before RPC", async () => {
    expect((await call({ action:"show", mode:"questions", pageSize:100 })).status).toBe(400);
    expect((await call({ action:"show", mode:"questions", sort:"random" })).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin writes before touching storage", async () => {
    expect(
      (await call({ action: "show", mode: "blank" }, "https://other.test"))
        .status,
    ).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    mocks.user = null;
    expect((await call({ action: "show", mode: "blank" })).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("only accepts IDs and commands, never arbitrary question text", async () => {
    expect(
      (await call({ action: "question", questionId, text: "injected" })).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("normalizes a pinned question command for the owner-checked database function", async () => {
    expect((await call({ action: "question", questionId })).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("control_live_presentation", {
      p_session_id: id,
      p_command: { action: "show", mode: "question", questionId },
    });
  });
  it("reports a concurrent poll replacement as conflict rather than claiming success", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "POLL_NOT_ACTIVE" },
    });
    expect(
      (await call({ action: "phase", pollId: id, phase: "open" })).status,
    ).toBe(409);
  });
});
