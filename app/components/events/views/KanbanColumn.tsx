'use client';

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { EventColumn } from "@/contexts/EventContext";
import { KanbanCard } from "@/components/events/views/KanbanCard";
import { useLanguage } from "@/app/contexts/LanguageContext";

export interface KanbanColumnProps {
  column: EventColumn;
}

export function KanbanColumn({ column }: KanbanColumnProps) {
  const { language } = useLanguage();
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column' },
  });

  return (
    <div className="h-full rounded-md flex flex-col">
      <div className="py-2 px-3 bg-gray-100 rounded-t-md">
        <h3 className="font-semibold">
          {column.name} ({column.events.length})
        </h3>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto max-h-[calc(100vh-200px)] p-2 space-y-2 rounded-b-md transition-colors ${
          isOver ? "bg-gray-50" : ""
        }`}
      >
        {column.events.length === 0 ? (
          <div className="p-4 text-center text-gray-500 h-20 border-2 border-dashed rounded-md flex items-center justify-center">
            {language === 'zh-TW' ? '拖放至此' : 'Drop here'}
          </div>
        ) : (
          column.events.map((event) => (
            <KanbanCard key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
