import { expect, it } from "vitest";
import { readAnnotationCommand } from "./live-annotation-command";
const current = { page: 1, deckUrl: "/slides.pdf", strokes: [] };
const message = {
  type: "annotation-action",
  page: 1,
  deckUrl: "/slides.pdf",
  baseStrokes: [],
  action: { type: "undo" },
};
it("accepts scoped actions and rejects stale decks, pages and malformed strokes", () => {
  expect(readAnnotationCommand(message, current)).toEqual({
    type: "undo",
    page: 1,
  });
  expect(readAnnotationCommand({ ...message, page: 2 }, current)).toBeNull();
  expect(
    readAnnotationCommand({ ...message, deckUrl: "/other.pdf" }, current),
  ).toBeNull();
  expect(
    readAnnotationCommand(
      { ...message, action: { type: "commit", strokes: [{ points: "bad" }] } },
      current,
    ),
  ).toBeNull();
  expect(
    readAnnotationCommand(
      { ...message, action: { type: "delete-session" } },
      current,
    ),
  ).toBeNull();
});
it("does not overwrite another window’s newer drawing", () => {
  expect(
    readAnnotationCommand(message, {
      ...current,
      strokes: [
        { id: "new", color: "#fb7185", width: 3, points: [{ x: 0, y: 0 }] },
      ],
    }),
  ).toBeNull();
});

it('compares drawing values independently of object key insertion order', () => {
 const original = [{id:'s',points:[{x:0,y:0}],color:'#fb7185',width:3}];
 expect(readAnnotationCommand({...message,baseStrokes:original},{...current,strokes:original})).toEqual({type:'undo',page:1});
});
