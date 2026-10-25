// @vitest-environment jsdom
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { usePresentationSnapshot } from "./usePresentationSnapshot";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const snap = {
  sessionId: "s",
  status: "open",
  mode: "deck",
  questions: [],
  answeredIds: [],
  poll: null,
  deckPage: 1,
  deckUrl: null,
  title: "Test",
};
const response = (value: unknown) => ({
  ok: true,
  status: 200,
  json: async () => value,
});
describe("snapshot recovery and commands", () => {
  it("does not lose a click while the initial read is in flight", async () => {
    let finish!: (value: unknown) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(response(snap));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => usePresentationSnapshot("/api/test"));
    let mutation!: Promise<boolean>;
    act(() => {
      mutation = result.current.command({ action: "show", mode: "blank" });
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(response(snap));
      await mutation;
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "show", mode: "blank" }),
      }),
    );
  });
  it("applies an optimistic patch before the write resolves, then overwrites it with the authoritative response", async () => {
    let finish!: (value: unknown) => void;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(snap))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => usePresentationSnapshot("/api/test"));
    await waitFor(() => expect(result.current.snapshot?.mode).toBe("deck"));
    act(() => {
      void result.current.command({ action: "show", mode: "blank" }, (prev) => ({
        ...prev,
        mode: "blank",
      }));
    });
    // The patch lands well before the POST settles - the fetch it triggers
    // is still paused on `finish` at this point.
    await waitFor(() => expect(result.current.snapshot?.mode).toBe("blank"));
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => {
      finish(response({ ...snap, mode: "poll" }));
      await Promise.resolve();
    });
    // The server's actual answer always wins over the guess.
    expect(result.current.snapshot?.mode).toBe("poll");
  });

  it("reverts an optimistic patch instead of leaving a guess on screen when the write fails", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(snap));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => usePresentationSnapshot("/api/test"));
    await waitFor(() => expect(result.current.snapshot?.mode).toBe("deck"));
    fetcher.mockResolvedValue({ ok: false, status: 500 });
    await act(async () => {
      expect(
        await result.current.command({ action: "show", mode: "blank" }, (prev) => ({
          ...prev,
          mode: "blank",
        })),
      ).toBe(false);
    });
    expect(result.current.snapshot?.mode).toBe("deck");
    expect(result.current.error).toBe(true);
  });

  it("refreshes on network recovery and fails visibly without pretending a write succeeded", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(snap));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => usePresentationSnapshot("/api/test"));
    await waitFor(() => expect(result.current.snapshot?.mode).toBe("deck"));
    fetcher.mockResolvedValue({ ok: false, status: 500 });
    await act(async () => {
      expect(
        await result.current.command({ action: "show", mode: "blank" }),
      ).toBe(false);
    });
    expect(result.current.snapshot?.mode).toBe("deck");
    expect(result.current.error).toBe(true);
    fetcher.mockResolvedValue(response({ ...snap, mode: "blank" }));
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(result.current.snapshot?.mode).toBe("blank"));
  });
});

describe("snapshot hand-off between presenter and projected windows", () => {
  it("applies a snapshot pushed by another window without another read, and drops an older read still in flight", async () => {
    let finishStale!: (value: unknown) => void;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(snap))
      .mockImplementationOnce(() => new Promise((resolve) => { finishStale = resolve; }))
      .mockResolvedValue(response({ ...snap, mode: "blank" }));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => usePresentationSnapshot("/api/test", "session-1"));
    await waitFor(() => expect(result.current.snapshot?.mode).toBe("deck"));
    // A periodic read starts, then the presenter's command result arrives first.
    act(() => { void result.current.refresh(); });
    const presenter = new BroadcastChannel("live-presentation:session-1");
    presenter.postMessage({ type: "snapshot", snapshot: { ...snap, mode: "blank" } });
    await waitFor(() => expect(result.current.snapshot?.mode).toBe("blank"));
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => { finishStale(response({ ...snap, mode: "deck" })); });
    expect(result.current.snapshot?.mode).toBe("blank");
    presenter.close();
  });
  it("sends the command's authoritative result to the other window", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(snap))
      .mockResolvedValue(response({ ...snap, mode: "poll" }));
    vi.stubGlobal("fetch", fetcher);
    const display = new BroadcastChannel("live-presentation:session-2");
    const received: unknown[] = [];
    display.onmessage = ({ data }) => received.push(data);
    const { result } = renderHook(() => usePresentationSnapshot("/api/test", "session-2"));
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    await act(async () => { await result.current.command({ action: "show", mode: "poll" }); });
    await waitFor(() => expect(received).toContainEqual({ type: "snapshot", snapshot: { ...snap, mode: "poll" }, pending: false }));
    display.close();
  });
});

describe("commands during a background read", () => {
  it("does not wait for a poll in flight, and that poll cannot undo the click", async () => {
    let finishPoll!: (value: unknown) => void;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(snap))
      .mockImplementationOnce(() => new Promise((resolve) => { finishPoll = resolve; }))
      .mockResolvedValue(response({ ...snap, mode: "blank" }));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => usePresentationSnapshot("/api/test"));
    await waitFor(() => expect(result.current.snapshot?.mode).toBe("deck"));
    act(() => { void result.current.refresh(); });
    let mutation!: Promise<boolean>;
    act(() => {
      mutation = result.current.command({ action: "show", mode: "blank" }, (previous) => ({ ...previous, mode: "blank" }));
    });
    // The POST went out without waiting for the poll.
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith("/api/test", expect.objectContaining({ method: "POST" })));
    await act(async () => { finishPoll(response(snap)); });
    expect(result.current.snapshot?.mode).toBe("blank");
    await act(async () => { await mutation; });
    expect(result.current.snapshot?.mode).toBe("blank");
  });
});

describe("optimistic hand-off", () => {
  it("shows a known outcome on the other window before the write returns, and reverts it if the write fails", async () => {
    let failWrite!: () => void;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(snap))
      .mockImplementationOnce(() => new Promise((_, reject) => { failWrite = () => reject(new Error("offline")); }))
      .mockResolvedValue(response(snap));
    vi.stubGlobal("fetch", fetcher);
    const display = new BroadcastChannel("live-presentation:session-3");
    const received: any[] = [];
    display.onmessage = ({ data }) => received.push(data);
    const { result } = renderHook(() => usePresentationSnapshot("/api/test", "session-3"));
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    let mutation!: Promise<boolean>;
    act(() => {
      mutation = result.current.command({ action: "show", mode: "blank" }, (previous) => ({ ...previous, mode: "blank" }));
    });
    await waitFor(() => expect(received.at(-1)?.snapshot?.mode).toBe("blank"));
    await act(async () => { failWrite(); await mutation; });
    await waitFor(() => expect(received.at(-1)?.snapshot?.mode).toBe("deck"));
    display.close();
  });
});

describe("remote optimistic state", () => {
  it("keeps another window's pending guess until its result arrives, even if a poll returns older state", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(snap));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => usePresentationSnapshot("/api/test", "session-4"));
    await waitFor(() => expect(result.current.snapshot?.mode).toBe("deck"));
    const presenter = new BroadcastChannel("live-presentation:session-4");
    presenter.postMessage({ type: "snapshot", snapshot: { ...snap, mode: "blank" }, pending: true });
    await waitFor(() => expect(result.current.snapshot?.mode).toBe("blank"));
    // A poll that starts now still sees the pre-write state on the server.
    await act(async () => { await result.current.refresh(); });
    expect(result.current.snapshot?.mode).toBe("blank");
    presenter.postMessage({ type: "snapshot", snapshot: { ...snap, mode: "blank", title: "confirmed" }, pending: false });
    await waitFor(() => expect(result.current.snapshot?.title).toBe("confirmed"));
    fetcher.mockResolvedValue(response({ ...snap, mode: "poll" }));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.snapshot?.mode).toBe("poll");
    presenter.close();
  });
});
