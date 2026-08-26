'use client';

import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEvents, Event, EventStatus } from "@/contexts/EventContext";
import { KanbanColumn } from "@/components/events/views/KanbanColumn";
import { KanbanCard } from "@/components/events/views/KanbanCard";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

const COLUMN_IDS: EventStatus[] = ['to_do', 'in_progress', 'done'];

export function KanbanView() {
  const { events, updateEvent } = useEvents();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const [itemsByColumn, setItemsByColumn] = useState<Record<EventStatus, string[]>>({
    to_do: [],
    in_progress: [],
    done: [],
  });
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);

  const eventsById = useMemo(() => {
    const map = new Map<string, Event>();
    events.forEach(e => map.set(e.id, e));
    return map;
  }, [events]);

  // Rebuild the per-column ordering whenever the underlying events change,
  // but skip it while a drag is in flight so the optimistic reorder isn't
  // immediately overwritten by a stale re-render.
  useEffect(() => {
    if (activeEvent) return;
    const next: Record<EventStatus, string[]> = { to_do: [], in_progress: [], done: [] };
    [...events]
      .sort((a, b) => a.position - b.position)
      .forEach(event => {
        if (next[event.status]) {
          next[event.status].push(event.id);
        }
      });
    setItemsByColumn(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findColumnOf = (id: string, columns: Record<EventStatus, string[]>): EventStatus | null => {
    if ((COLUMN_IDS as string[]).includes(id)) return id as EventStatus;
    return (Object.keys(columns) as EventStatus[]).find(col => columns[col].includes(id)) ?? null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const eventData = eventsById.get(String(event.active.id));
    setActiveEvent(eventData ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    setItemsByColumn(prev => {
      const activeColumn = findColumnOf(activeId, prev);
      const overColumn = findColumnOf(overId, prev);
      if (!activeColumn || !overColumn || activeColumn === overColumn) return prev;

      const activeItems = prev[activeColumn].filter(id => id !== activeId);
      const overItems = [...prev[overColumn]];
      const overIndex = overItems.indexOf(overId);
      const insertIndex = overIndex >= 0 ? overIndex : overItems.length;
      overItems.splice(insertIndex, 0, activeId);

      return {
        ...prev,
        [activeColumn]: activeItems,
        [overColumn]: overItems,
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveEvent(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    setItemsByColumn(prev => {
      const activeColumn = findColumnOf(activeId, prev);
      const overColumn = findColumnOf(overId, prev);
      if (!activeColumn || !overColumn) return prev;

      let finalColumns = prev;
      if (activeColumn === overColumn && activeId !== overId) {
        const items = prev[activeColumn];
        const oldIndex = items.indexOf(activeId);
        const newIndex = items.indexOf(overId);
        if (oldIndex !== -1 && newIndex !== -1) {
          finalColumns = { ...prev, [activeColumn]: arrayMove(items, oldIndex, newIndex) };
        }
      }

      // Persist every event whose status or position actually changed.
      (Object.keys(finalColumns) as EventStatus[]).forEach(status => {
        finalColumns[status].forEach((id, index) => {
          const original = eventsById.get(id);
          if (!original) return;
          const position = index + 1;
          if (original.status !== status || original.position !== position) {
            updateEvent({ ...original, status, position }).catch(err => {
              console.error(`Failed to update event ${id}:`, err);
            });
          }
        });
      });

      return finalColumns;
    });
  };

  const columns = COLUMN_IDS.map(id => ({
    id,
    name: id === 'to_do' ? t('to_do') : id === 'in_progress' ? t('events_in_progress') : t('done'),
    events: itemsByColumn[id].map(eventId => eventsById.get(eventId)).filter((e): e is Event => !!e),
  }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map(column => (
          <SortableContext
            key={column.id}
            items={itemsByColumn[column.id]}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumn column={column} />
          </SortableContext>
        ))}
      </div>
      <DragOverlay>
        {activeEvent ? <KanbanCard event={activeEvent} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
