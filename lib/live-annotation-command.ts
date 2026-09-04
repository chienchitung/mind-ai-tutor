import { z } from "zod";
import type { AnnotationAction, InkStroke } from "./presentation-annotations";
const point = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
const strokes = z
  .array(
    z.object({
      id: z.string().max(200),
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
      width: z.number().positive().max(50),
      points: z.array(point).max(5000),
    }),
  )
  .max(500);
const schema = z.object({
  type: z.literal("annotation-action"),
  page: z.number().int().positive(),
  deckUrl: z.string(),
  baseStrokes: strokes,
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("commit"), strokes }),
    z.object({ type: z.enum(["undo", "redo", "clear"]) }),
  ]),
});
/** Only apply edits made against the current slide and drawing. */
export function readAnnotationCommand(
  message: unknown,
  current: { page?: number; deckUrl?: string | null; strokes: InkStroke[] },
): AnnotationAction | null {
  const parsed = schema.safeParse(message);
  if (!parsed.success) return null;
  const value = parsed.data;
  const currentStrokes = strokes.safeParse(current.strokes);
  if (!currentStrokes.success) return null;
  if (
    value.page !== current.page ||
    value.deckUrl !== current.deckUrl ||
    JSON.stringify(value.baseStrokes) !== JSON.stringify(currentStrokes.data)
  )
    return null;
  return { ...value.action, page: value.page };
}
