import { Event, EventStatus } from "@/contexts/EventContext";

// Given the post-drop column layout (ordered event ids per column) and a
// lookup of the events as they existed before the drop, returns only the
// events whose status or position actually changed, with those new values
// applied. Pulled out as a pure function so the reorder math that feeds the
// batched updateEvents() call can be unit tested without mocking Supabase,
// react-query, or dnd-kit.
export function computeReorderedEvents(
  columns: Record<EventStatus, string[]>,
  eventsById: Map<string, Event>
): Event[] {
  const changed: Event[] = [];

  (Object.keys(columns) as EventStatus[]).forEach(status => {
    columns[status].forEach((id, index) => {
      const original = eventsById.get(id);
      if (!original) return;
      const position = index + 1;
      if (original.status !== status || original.position !== position) {
        changed.push({ ...original, status, position });
      }
    });
  });

  return changed;
}
