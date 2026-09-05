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
