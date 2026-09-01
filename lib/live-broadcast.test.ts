import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  send: vi.fn(),
  removeChannel: vi.fn(),
  subscribe: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    channel: () => mock,
    removeChannel: mock.removeChannel,
  }),
}));
import { broadcastLiveUpdate } from "./live-broadcast";
beforeEach(() => {
  vi.clearAllMocks();
  mock.send.mockResolvedValue("ok");
});
describe("HTTP live broadcast", () => {
  it("sends without subscribing or opening a WebSocket", async () => {
    await broadcastLiveUpdate("session", "reaction:sent", { kind: "applause" });
    expect(mock.subscribe).not.toHaveBeenCalled();
    expect(mock.send).toHaveBeenCalledWith(
      {
        type: "broadcast",
        event: "reaction:sent",
        payload: { kind: "applause" },
      },
      { timeout: 5000 },
    );
    expect(mock.removeChannel).toHaveBeenCalledOnce();
  });
  it("reports transport failure and always cleans up", async () => {
    mock.send.mockResolvedValue("timed out");
    await expect(
      broadcastLiveUpdate("session", "reaction:sent", {}),
    ).rejects.toThrow("BROADCAST_FAILED");
    expect(mock.removeChannel).toHaveBeenCalledOnce();
  });
});
