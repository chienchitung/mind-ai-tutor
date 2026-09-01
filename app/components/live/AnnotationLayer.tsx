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
}
interface Gesture {
  pointerId: number;
  tool: 'pen' | 'eraser';
  points: InkPoint[];
  erased: Set<string>;
}

export function AnnotationLayer({ strokes, tool, color, width, label, onCommit, onDrawingChange }: Props) {
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
    if (!cancelled) {
      move(event);
      if (current.tool === 'pen')
        onCommit([...strokes, { id: crypto.randomUUID(), points: current.points, color, width }]);
      else if (current.erased.size) onCommit(strokes.filter((stroke) => !current.erased.has(stroke.id)));
    }
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
          ambiguity. */}
      {pointer && (tool === 'laser' || tool === 'eraser') && (
        <div
          data-laser-pointer={tool === 'laser' ? '' : undefined}
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${pointer.x * 100}%`,
            top: `${pointer.y * 100}%`,
            width: tool === 'laser' ? 22 : 30,
            height: tool === 'laser' ? 22 : 30,
            border: `${tool === 'laser' ? 3 : 2}px solid ${tool === 'laser' ? '#ff244c' : '#111827'}`,
            boxShadow:
              tool === 'laser'
                ? '0 0 0 8px rgba(251,113,133,0.3), 0 0 14px 3px rgba(255,36,76,0.65)'
                : '0 0 0 6px rgba(255,255,255,0.35)',
          }}
        />
      )}
    </div>
  );
}
