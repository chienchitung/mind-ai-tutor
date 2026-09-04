/** Coordinates are relative to the PDF page, never to the letterboxed screen. */
export interface InkPoint {
  x: number;
  y: number;
}
export interface InkStroke {
  id: string;
  points: InkPoint[];
  color: string;
  width: number;
}
export type PresentationTool = 'cursor' | 'laser' | 'pen' | 'eraser';
export interface InkHistory {
  strokes: InkStroke[];
  past: InkStroke[][];
  future: InkStroke[][];
}
export type AnnotationState = Record<number, InkHistory>;
export type AnnotationAction =
  { type: 'commit'; page: number; strokes: InkStroke[] } | { type: 'undo' | 'redo' | 'clear'; page: number };
export const EMPTY_INK: InkHistory = { strokes: [], past: [], future: [] };
const HISTORY_LIMIT = 50;

export function annotationReducer(state: AnnotationState, action: AnnotationAction): AnnotationState {
  const current = state[action.page] ?? EMPTY_INK;
  if (action.type === 'undo') {
    if (!current.past.length) return state;
    return {
      ...state,
      [action.page]: {
        strokes: current.past[current.past.length - 1],
        past: current.past.slice(0, -1),
        future: [current.strokes, ...current.future].slice(0, HISTORY_LIMIT),
      },
    };
  }
  if (action.type === 'redo') {
    if (!current.future.length) return state;
    return {
      ...state,
      [action.page]: {
        strokes: current.future[0],
        past: [...current.past, current.strokes].slice(-HISTORY_LIMIT),
        future: current.future.slice(1),
      },
    };
  }
  const strokes = action.type === 'commit' ? action.strokes : [];
  if (strokes === current.strokes || (!strokes.length && !current.strokes.length)) return state;
  return {
    ...state,
    [action.page]: { strokes, past: [...current.past, current.strokes].slice(-HISTORY_LIMIT), future: [] },
  };
}

export function pagePoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): InkPoint {
  return {
    x: Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))),
    y: Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height))),
  };
}

function pointSegmentDistance(p: InkPoint, a: InkPoint, b: InkPoint): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function cross(a: InkPoint, b: InkPoint, c: InkPoint) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function segmentsCross(a: InkPoint, b: InkPoint, c: InkPoint, d: InkPoint): boolean {
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

/** Erase whole strokes, including a fast sweep crossing between pointer samples. */
export function hitsStroke(
  stroke: InkStroke,
  from: InkPoint,
  to: InkPoint,
  size: { width: number; height: number },
  radius = 12,
): boolean {
  const pixel = (p: InkPoint) => ({ x: p.x * size.width, y: p.y * size.height });
  const a = pixel(from),
    b = pixel(to),
    threshold = radius + stroke.width / 2;
  return stroke.points.some((point, index) => {
    const c = pixel(point),
      d = pixel(stroke.points[Math.max(0, index - 1)]);
    return (
      segmentsCross(a, b, c, d) ||
      Math.min(
        pointSegmentDistance(c, a, b),
        pointSegmentDistance(d, a, b),
        pointSegmentDistance(a, c, d),
        pointSegmentDistance(b, c, d),
      ) <= threshold
    );
  });
}

/** Keep equal page numbers from different slide decks independent. */
export function deckAnnotationReducer(state: Record<string, AnnotationState>, event: { deckUrl: string; action: AnnotationAction }): Record<string, AnnotationState> {
  return { ...state, [event.deckUrl]: annotationReducer(state[event.deckUrl] ?? {}, event.action) };
}
