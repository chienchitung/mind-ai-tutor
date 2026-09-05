// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useProjectionInk } from "./useProjectionInk";
import { type InkStroke } from "@/lib/presentation-annotations";
afterEach(cleanup);
const stroke = (id: string): InkStroke => ({
  id,
  color: "#fff",
  width: 3,
  points: [{ x: 0.2, y: 0.3 }],
});
const local = [stroke("local")];
const teacher = [stroke("teacher")];
const remote = (strokes: InkStroke[] = [], page = 1) => ({
  deckUrl: "a.pdf",
  page,
  strokes,
});
function setup() {
  const send = vi.fn();
  const hook = renderHook(
    ({ connected, value, deck, page }) =>
      useProjectionInk(deck, page, value, connected, send),
    {
      initialProps: {
        connected: false,
        value: remote(),
        deck: "a.pdf",
        page: 1,
      },
    },
  );
  return { ...hook, send };
}
it("supports offline drawing, undo, redo and erasing without sending commands", () => {
  const { result, send } = setup();
  act(() => result.current.act({ type: "commit", page: 1, strokes: local }));
  expect(result.current.history.strokes).toEqual(local);
  act(() => result.current.act({ type: "undo", page: 1 }));
  expect(result.current.history.strokes).toEqual([]);
  act(() => result.current.act({ type: "redo", page: 1 }));
  expect(result.current.history.strokes).toEqual(local);
  act(() => result.current.act({ type: "commit", page: 1, strokes: [] }));
  expect(result.current.history.strokes).toEqual([]);
  expect(send).not.toHaveBeenCalled();
});
it("syncs unchanged-base drafts after reconnect and retires them only after acknowledgement", () => {
  const { result, rerender, send } = setup();
  act(() => result.current.act({ type: "commit", page: 1, strokes: local }));
  rerender({ connected: true, value: remote(), deck: "a.pdf", page: 1 });
  expect(send).toHaveBeenCalledWith({
    type: "annotation-action",
    deckUrl: "a.pdf",
    page: 1,
    baseStrokes: [],
    action: { type: "commit", page: 1, strokes: local },
  });
  expect(result.current.pending).toBe(true);
  rerender({ connected: true, value: remote(local), deck: "a.pdf", page: 1 });
  expect(result.current.pending).toBe(false);
  expect(result.current.history.strokes).toEqual(local);
});
it("preserves conflicting drawings until the user explicitly selects the teacher copy", () => {
  const { result, rerender, send } = setup();
  act(() => result.current.act({ type: "commit", page: 1, strokes: local }));
  rerender({ connected: true, value: remote(teacher), deck: "a.pdf", page: 1 });
  expect(result.current.conflict).toBe(true);
  expect(result.current.history.strokes).toEqual(local);
  expect(send).not.toHaveBeenCalled();
  act(() => result.current.useRemote());
  expect(result.current.history.strokes).toEqual(teacher);
  expect(result.current.pending).toBe(false);
});
it("rebases onto the latest teacher drawing only after an explicit overwrite choice", () => {
  const { result, rerender, send } = setup();
  act(() => result.current.act({ type: "commit", page: 1, strokes: local }));
  rerender({ connected: true, value: remote(teacher), deck: "a.pdf", page: 1 });
  expect(send).not.toHaveBeenCalled();
  act(() => result.current.keepLocal());
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      baseStrokes: teacher,
      action: { type: "commit", page: 1, strokes: local },
    }),
  );
});
it("isolates offline drafts by deck and page and waits for matching remote state", () => {
  const { result, rerender, send } = setup();
  act(() => result.current.act({ type: "commit", page: 1, strokes: local }));
  rerender({ connected: true, value: remote(), deck: "a.pdf", page: 2 });
  expect(result.current.history.strokes).toEqual([]);
  act(() => result.current.act({ type: "commit", page: 2, strokes: teacher }));
  expect(send).not.toHaveBeenCalled();
  rerender({ connected: false, value: remote(), deck: "b.pdf", page: 1 });
  expect(result.current.history.strokes).toEqual([]);
  rerender({ connected: false, value: remote(), deck: "a.pdf", page: 1 });
  expect(result.current.history.strokes).toEqual(local);
});
