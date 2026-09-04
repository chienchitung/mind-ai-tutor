import type { InkPoint, InkStroke, PresentationTool } from '@/lib/presentation-annotations';

interface Props {
  strokes: InkStroke[];
  draft: InkPoint[];
  pointer: InkPoint | null;
  tool: PresentationTool;
  color: string;
  width: number;
  label: string;
}

/** Read-only mirror of AnnotationLayer's visual output - no pointer event
 * handlers, nothing interactive. Renders whatever committed strokes plus
 * live in-progress draft/pointer state a control window broadcasts, for
 * the projected display window the audience actually watches. */
export function RemoteInkOverlay({ strokes, draft, pointer, tool, color, width, label }: Props) {
  const visible = draft.length ? [...strokes, { id: 'draft', points: draft, color, width }] : strokes;

  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full">
      <svg
        role="img"
        aria-label={label}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
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
          />
        ))}
      </svg>
      {/* Same non-SVG pointer dot as AnnotationLayer, and for the same
          reason: this viewBox is stretched non-uniformly to match the
          deck's aspect ratio, and an SVG circle's non-scaling-stroke
          vector-effect only stays circular under a uniform scale. */}
      {pointer && (tool === 'laser' || tool === 'eraser') && (
        <div
          data-laser-pointer={tool === 'laser' ? '' : undefined}
          aria-hidden="true"
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
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
