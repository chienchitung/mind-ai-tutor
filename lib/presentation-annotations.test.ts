import { deckAnnotationReducer } from './presentation-annotations';
import { describe, expect, it } from 'vitest';
import {
  annotationReducer,
  EMPTY_INK,
  hitsStroke,
  pagePoint,
  type InkStroke,
} from './presentation-annotations';
const line: InkStroke = {
  id: 'a',
  color: '#fff',
  width: 3,
  points: [
    { x: 0.2, y: 0.5 },
    { x: 0.8, y: 0.5 },
  ],
};

describe('page annotations', () => {
  it('keeps independent history for each slide', () => {
    let state = annotationReducer({}, { type: 'commit', page: 1, strokes: [line] });
    state = annotationReducer(state, { type: 'commit', page: 2, strokes: [{ ...line, id: 'b' }] });
    state = annotationReducer(state, { type: 'undo', page: 1 });
    expect(state[1].strokes).toEqual([]);
    expect(state[2].strokes[0].id).toBe('b');
    state = annotationReducer(state, { type: 'redo', page: 1 });
    expect(state[1].strokes).toEqual([line]);
  });
  it('can undo clearing a page and discards redo after a new edit', () => {
    let state = annotationReducer({}, { type: 'commit', page: 1, strokes: [line] });
    state = annotationReducer(state, { type: 'clear', page: 1 });
    expect(state[1].strokes).toEqual([]);
    state = annotationReducer(state, { type: 'undo', page: 1 });
    expect(state[1].strokes).toEqual([line]);
    state = annotationReducer(state, { type: 'commit', page: 1, strokes: [line, { ...line, id: 'c' }] });
    expect(state[1].future).toEqual([]);
    expect(EMPTY_INK.strokes).toEqual([]);
  });
  it('normalizes against the fitted PDF page and clamps a captured pointer outside it', () => {
    const rect = { left: 100, top: 200, width: 800, height: 400 };
    expect(pagePoint(500, 300, rect)).toEqual({ x: 0.5, y: 0.25 });
    expect(pagePoint(1500, 100, rect)).toEqual({ x: 1, y: 0 });
  });
  it('erases a stroke crossed between two widely spaced eraser samples', () => {
    expect(hitsStroke(line, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }, { width: 800, height: 400 })).toBe(true);
    expect(hitsStroke(line, { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { width: 800, height: 400 })).toBe(false);
  });
  it('uses screen distance consistently for a wide page and erases dots', () => {
    expect(hitsStroke(line, { x: 0.5, y: 0.52 }, { x: 0.5, y: 0.52 }, { width: 1600, height: 400 })).toBe(
      true,
    );
    const dot = { ...line, points: [{ x: 0.4, y: 0.4 }] };
    expect(hitsStroke(dot, { x: 0.4, y: 0.4 }, { x: 0.4, y: 0.4 }, { width: 800, height: 400 })).toBe(true);
  });
});


it('isolates shared history by deck URL, including undo', () => {
  const stroke = { id:'s',points:[{x:0,y:0}],color:'#fb7185',width:3 };
  let state = deckAnnotationReducer({}, {deckUrl:'a.pdf',action:{type:'commit',page:1,strokes:[stroke]}});
  state = deckAnnotationReducer(state, {deckUrl:'b.pdf',action:{type:'commit',page:1,strokes:[{...stroke,id:'b'}]}});
  state = deckAnnotationReducer(state, {deckUrl:'b.pdf',action:{type:'undo',page:1}});
  expect(state['a.pdf'][1].strokes).toEqual([stroke]);
  expect(state['b.pdf'][1].strokes).toEqual([]);
});
