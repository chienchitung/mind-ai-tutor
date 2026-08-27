import { describe, expect, it } from 'vitest';
import { computeReorderedEvents } from './kanbanReorder';
import { Event, EventStatus } from '@/contexts/EventContext';

function makeEvent(overrides: Partial<Event> & Pick<Event, 'id' | 'status' | 'position'>): Event {
  return {
    title: 'Untitled',
    description: '',
    type: 'other',
    priority: 'medium',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-01T00:00:00.000Z',
    tags: [],
    attachments: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeReorderedEvents', () => {
  it('returns nothing when the column layout matches current status/position', () => {
    const a = makeEvent({ id: 'a', status: 'to_do', position: 1 });
    const b = makeEvent({ id: 'b', status: 'to_do', position: 2 });
    const eventsById = new Map([['a', a], ['b', b]]);
    const columns: Record<EventStatus, string[]> = {
      to_do: ['a', 'b'],
      in_progress: [],
      done: [],
    };

    expect(computeReorderedEvents(columns, eventsById)).toEqual([]);
  });

  it('reports every sibling whose position shifts within the same column, not just the dragged card', () => {
    // a, b, c start at positions 1, 2, 3. Dragging c to the front pushes a and b down too.
    const a = makeEvent({ id: 'a', status: 'to_do', position: 1 });
    const b = makeEvent({ id: 'b', status: 'to_do', position: 2 });
    const c = makeEvent({ id: 'c', status: 'to_do', position: 3 });
    const eventsById = new Map([['a', a], ['b', b], ['c', c]]);
    const columns: Record<EventStatus, string[]> = {
      to_do: ['c', 'a', 'b'],
      in_progress: [],
      done: [],
    };

    const changed = computeReorderedEvents(columns, eventsById);
    const byId = Object.fromEntries(changed.map(e => [e.id, e]));

    expect(Object.keys(byId).sort()).toEqual(['a', 'b', 'c']);
    expect(byId.c.position).toBe(1);
    expect(byId.a.position).toBe(2);
    expect(byId.b.position).toBe(3);
    // Status is unchanged for a same-column reorder.
    expect(byId.a.status).toBe('to_do');
  });

  it('updates both status and position when a card moves to a different column', () => {
    const a = makeEvent({ id: 'a', status: 'to_do', position: 1 });
    const eventsById = new Map([['a', a]]);
    const columns: Record<EventStatus, string[]> = {
      to_do: [],
      in_progress: ['a'],
      done: [],
    };

    const changed = computeReorderedEvents(columns, eventsById);

    expect(changed).toEqual([{ ...a, status: 'in_progress', position: 1 }]);
  });

  it('ignores ids that no longer exist in the events lookup', () => {
    const eventsById = new Map<string, Event>();
    const columns: Record<EventStatus, string[]> = {
      to_do: ['ghost'],
      in_progress: [],
      done: [],
    };

    expect(computeReorderedEvents(columns, eventsById)).toEqual([]);
  });
});
