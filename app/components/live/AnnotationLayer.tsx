'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  hitsStroke,
  pagePoint,
  type InkPoint,
  type InkStroke,
  type PresentationTool,
} from '@/lib/presentation-annotations';

interface Props {
  strokes: InkStroke[];
  tool: PresentationTool;
  color: string;
  width: number;
  label: string;
  onCommit: (strokes: InkStroke[]) => void;
  onDrawingChange: (drawing: boolean) => void;
  /** Fires on every change to the in-progress (uncommitted) draft stroke or
   * the laser/eraser pointer position - draft is empty and pointer is null
   * between gestures. A parent can use this to mirror drawing in real time
   * onto a second, read-only surface (e.g. a projected display window)
   * before the stroke is ever committed. */
  onLiveChange?: (live: { draft: InkPoint[]; pointer: InkPoint | null }) => void;
}
interface Gesture {
  pointerId: number;
  tool: 'pen' | 'eraser';
  points: InkPoint[];
  erased: Set<string>;
}

export function AnnotationLayer({ strokes, tool, color, width, label, onCommit, onDrawingChange, onLiveChange }: Props) {
  const surfaceRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<InkPoint[]>([]);
  const [erased, setErased] = useState<Set<string>>(new Set());
  const [pointer, setPointer] = useState<InkPoint | null>(null);
  const laserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (laserTimer.current) clearTimeout(laserTimer.current);
      onDrawingChange(false);
    },
    [onDrawingChange],
  );
  useEffect(() => {
    setPointer(null);
  }, [tool]);
  // A plain effect (rather than calling onLiveChange at every setDraft/
  // setPointer call site) so every state transition is reported exactly
  // once, including the laser-hide timeout's own setPointer(null).
  useEffect(() => {
    onLiveChange?.({ draft, pointer });
  }, [draft, pointer, onLiveChange]);

  function sample(event: PointerEvent<SVGSVGElement>) {
    return pagePoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
  }
  function showPointer(point: InkPoint) {
    setPointer(point);
    if (laserTimer.current) clearTimeout(laserTimer.current);
    if (tool === 'laser') laserTimer.current = setTimeout(() => setPointer(null), 1000);
  }
  function erase(from: InkPoint, to: InkPoint, event: PointerEvent<SVGSVGElement>) {
    const current = gesture.current;
    if (!current) return;
    for (const stroke of strokes) {
      if (hitsStroke(stroke, from, to, event.currentTarget.getBoundingClientRect()))
        current.erased.add(stroke.id);
    }
    setErased(new Set(current.erased));
  }
  function start(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || event.isPrimary === false || gesture.current) return;
    if (tool === 'cursor') return;
    const point = sample(event);
    event.preventDefault();
    // Do not start the context-menu long-press timer while drawing on touch screens.
    event.stopPropagation();
    surfaceRef.current?.focus({ preventScroll: true });
    showPointer(point);
    if (tool === 'laser') return;
    gesture.current = { pointerId: event.pointerId, tool, points: [point], erased: new Set() };
    event.currentTarget.setPointerCapture(event.pointerId);
    onDrawingChange(true);
    if (tool === 'pen') setDraft([point]);
    else erase(point, point, event);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (tool === 'laser' || tool === 'eraser') showPointer(sample(event));
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = sample(event);
    const previous = current.points[current.points.length - 1];
    if (current.tool === 'eraser') erase(previous, point, event);
    current.points.push(point);
    if (current.tool === 'pen') setDraft([...current.points]);
  }
  function finish(event: PointerEvent<SVGSVGElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    // pointercancel/lostpointercapture can occur after a long drag crosses the
    // PDF edge or the browser briefly loses capture. Keep the valid portion
    // already sampled instead of throwing away the whole visible stroke.
    // A normal pointer-up samples its final coordinate as before.
    if (!cancelled) move(event);
    if (current.tool === 'pen' && current.points.length > 1)
      onCommit([...strokes, { id: crypto.randomUUID(), points: current.points, color, width }]);
    else if (current.tool === 'eraser' && current.erased.size)
      onCommit(strokes.filter((stroke) => !current.erased.has(stroke.id)));
    gesture.current = null;
    setDraft([]);
    setErased(new Set());
    onDrawingChange(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const visible = strokes.filter((stroke) => !erased.has(stroke.id));
  if (draft.length) visible.push({ id: 'draft', points: draft, color, width });

  return (
    <div className="absolute inset-0 h-full w-full">
      <svg
        ref={surfaceRef}
        data-annotation-surface=""
        role="img"
        aria-label={label}
        tabIndex={0}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
        style={{
          touchAction: tool === 'cursor' ? 'auto' : 'none',
          cursor:
            tool === 'laser' ? 'none' : tool === 'pen' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'default',
        }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={(event) => finish(event)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={(event) => finish(event, true)}
        onPointerLeave={() => {
          if (!gesture.current) setPointer(null);
        }}
      >
        {visible.map((stroke) => (
          <polyline
            key={stroke.id}
            data-ink-stroke={stroke.id}
            points={stroke.points.map((p) => `${p.x * 1000},${p.y * 1000}`).join(' ')}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ))}
      </svg>
      {/* A plain positioned div, not an SVG circle: vector-effect="non-scaling-
          stroke" is only reliably circular under a UNIFORM scale, and this
          surface's viewBox is stretched non-uniformly (preserveAspectRatio=
          "none") to match the deck's own aspect ratio - under that anisotropic
          transform, some browsers render the stroke practically invisible.
          Percentage positioning plus a fixed-pixel border/glow has no such
          ambiguity. Colors/sizing mirror the very first laser design: a soft
          rose halo behind a solid red core. */}
      {pointer && (tool === 'laser' || tool === 'eraser') && (
        <div
          data-laser-pointer={tool === 'laser' ? '' : undefined}
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={
            tool === 'laser'
              ? {
                  left: `${pointer.x * 100}%`,
                  top: `${pointer.y * 100}%`,
                  width: 16,
                  height: 16,
                  background: 'rgba(251,113,133,0.3)',
                }
              : {
                  left: `${pointer.x * 100}%`,
                  top: `${pointer.y * 100}%`,
                  width: 30,
                  height: 30,
                  border: '2px solid #111827',
                  boxShadow: '0 0 0 6px rgba(255,255,255,0.35)',
                }
          }
        >
          {tool === 'laser' && (
            <span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ width: 7, height: 7, background: '#ff244c' }}
            />
          )}
        </div>
      )}
    </div>
  );
}
