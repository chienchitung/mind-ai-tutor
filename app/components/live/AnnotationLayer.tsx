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
interface TrailDot {
  id: number;
  x: number;
  y: number;
}
/** How many recent laser positions can be fading on screen at once. */
const TRAIL_LENGTH = 6;
/** How long a single trail dot takes to fade out and get removed. */
const TRAIL_FADE_MS = 320;

export function AnnotationLayer({ strokes, tool, color, width, label, onCommit, onDrawingChange }: Props) {
  const surfaceRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<InkPoint[]>([]);
  const [erased, setErased] = useState<Set<string>>(new Set());
  const [pointer, setPointer] = useState<InkPoint | null>(null);
  const [trail, setTrail] = useState<TrailDot[]>([]);
  const laserTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailId = useRef(0);
  const trailTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(
    () => () => {
      if (laserTimer.current) clearTimeout(laserTimer.current);
      trailTimers.current.forEach(clearTimeout);
      trailTimers.current.clear();
      onDrawingChange(false);
    },
    [onDrawingChange],
  );
  useEffect(() => {
    setPointer(null);
    setTrail([]);
    trailTimers.current.forEach(clearTimeout);
    trailTimers.current.clear();
  }, [tool]);

  function sample(event: PointerEvent<SVGSVGElement>) {
    return pagePoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
  }
  function addTrailDot(point: InkPoint) {
    const id = trailId.current++;
    setTrail((previous) => [...previous, { id, ...point }].slice(-TRAIL_LENGTH));
    const timer = setTimeout(() => {
      trailTimers.current.delete(timer);
      setTrail((previous) => previous.filter((dot) => dot.id !== id));
    }, TRAIL_FADE_MS);
    trailTimers.current.add(timer);
  }
  function showPointer(point: InkPoint) {
    setPointer(point);
    if (laserTimer.current) clearTimeout(laserTimer.current);
    if (tool === 'laser') {
      laserTimer.current = setTimeout(() => setPointer(null), 1000);
      addTrailDot(point);
    }
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
          if (!gesture.current) {
            setPointer(null);
            setTrail([]);
            trailTimers.current.forEach(clearTimeout);
            trailTimers.current.clear();
          }
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
          ambiguity. Colors/sizing mirror the very first laser design (a soft
          rose halo behind a solid red core); movement leaves a short fading
          trail, the way Google Meet's laser pointer does. */}
      {tool === 'laser' &&
        trail.map((dot, index) => {
          const progress = (index + 1) / trail.length;
          return (
            <div
              key={dot.id}
              data-laser-trail=""
              aria-hidden="true"
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${dot.x * 100}%`,
                top: `${dot.y * 100}%`,
                width: 5 + progress * 6,
                height: 5 + progress * 6,
                background: '#ff244c',
                opacity: progress * 0.5,
                transition: 'opacity 120ms linear, width 120ms linear, height 120ms linear',
              }}
            />
          );
        })}
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
