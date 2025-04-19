'use client';

import React, { useState } from "react";
import { 
  Calendar, 
  Clock, 
  MoreHorizontal, 
  Edit, 
  Trash, 
  GraduationCap, 
  BookOpen, 
  BarChart2, 
  CalendarClock, 
  Users,
  GripVertical
} from "lucide-react";
import { format } from "date-fns";
import { EventColumn, Event, EventType } from "@/contexts/EventContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEvents } from "@/contexts/EventContext";
import { EventFormDialog } from "@/components/events/EventFormDialog";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

export interface KanbanColumnProps {
  column: EventColumn;
  onDragStart: (e: React.DragEvent, eventId: string, sourceColumn: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, columnId: string, eventId?: string, position?: 'top' | 'bottom') => void;
  onDrop: (e: React.DragEvent, targetColumn: string, targetEventId?: string, position?: 'top' | 'bottom') => void;
  isDragging: boolean;
  draggedEventId: string | null;
  draggedSourceColumn: string | null;
  dragOverColumn: string | null;
  dragOverEventId: string | null;
  dragPosition: number | null;
}

export function KanbanColumn({
  column,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragging,
  draggedEventId,
  draggedSourceColumn,
  dragOverColumn,
  dragOverEventId,
  dragPosition
}: KanbanColumnProps) {
  const { deleteEvent } = useEvents();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setIsFormOpen(true);
  };

  // Format status for display
  const statusColors = {
    to_do: "bg-blue-100 text-blue-800",
    in_progress: "bg-amber-100 text-amber-800",
    done: "bg-green-100 text-green-800"
  };
  
  // Event type icons
  const typeIcons: Record<EventType, React.ReactNode> = {
    course: <GraduationCap className="h-3 w-3 text-blue-500" />,
    workshop: <BookOpen className="h-3 w-3 text-purple-500" />,
    training: <BarChart2 className="h-3 w-3 text-emerald-500" />,
    planning: <CalendarClock className="h-3 w-3 text-amber-500" />,
    meeting: <Users className="h-3 w-3 text-pink-500" />,
    other: <Calendar className="h-3 w-3 text-gray-500" />
  };

  const handleDragOver = (e: React.DragEvent, eventId: string) => {
    e.stopPropagation();
    
    // Calculate if we're at the top or bottom half of the card
    if (e.currentTarget instanceof HTMLElement) {
      const rect = e.currentTarget.getBoundingClientRect();
      const isTopHalf = e.clientY - rect.top < rect.height / 2;
      onDragOver(e, column.id, eventId, isTopHalf ? 'top' : 'bottom');
    }
  };
  
  const handleDrop = (e: React.DragEvent, eventId: string) => {
    e.stopPropagation();
    
    // Same calculation for top/bottom position
    if (e.currentTarget instanceof HTMLElement) {
      const rect = e.currentTarget.getBoundingClientRect();
      const isTopHalf = e.clientY - rect.top < rect.height / 2;
      onDrop(e, column.id, eventId, isTopHalf ? 'top' : 'bottom');
    }
  };
  
  // 獲取翻譯的優先級或類型
  const getTranslation = (key: string): string => {
    return language === 'zh-TW' ? 
      {
        'high': '高',
        'medium': '中',
        'low': '低',
        'course': '課程',
        'workshop': '工作坊',
        'training': '訓練',
        'planning': '規劃',
        'meeting': '會議',
        'other': '其他',
        'edit': '編輯'
      }[key] || key : 
      {
        'high': 'High',
        'medium': 'Medium',
        'low': 'Low',
        'course': 'Course',
        'workshop': 'Workshop',
        'training': 'Training',
        'planning': 'Planning',
        'meeting': 'Meeting',
        'other': 'Other',
        'edit': 'Edit'
      }[key] || key;
  };

  return (
    <div className="h-full rounded-md flex flex-col">
      <div className="py-2 px-3 bg-gray-100 rounded-t-md">
        <h3 className="font-semibold">
          {column.name} ({column.events.length})
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-200px)] p-2 space-y-2">
        {column.events.length === 0 ? (
          <div 
            className="p-4 text-center text-gray-500 h-20 border-2 border-dashed rounded-md flex items-center justify-center"
            onDragOver={(e) => onDragOver(e, column.id)}
            onDrop={(e) => onDrop(e, column.id)}
          >
            {language === 'zh-TW' ? '拖放至此' : 'Drop here'}
          </div>
        ) : (
          column.events.map((event: Event) => (
            <Card
              key={event.id}
              draggable
              data-event-id={event.id}
              onDragStart={(e) => onDragStart(e, event.id, column.id)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => handleDragOver(e, event.id)}
              onDrop={(e) => handleDrop(e, event.id)}
              className={`kanban-card p-3 mb-2 cursor-move hover:shadow-md relative transition-all duration-200 ${
                isDragging && draggedEventId === event.id
                  ? "opacity-50 scale-95"
                  : "opacity-100 scale-100"
              } ${
                isDragging && 
                dragOverEventId === event.id && 
                draggedEventId !== event.id ? 
                  (dragPosition === 0 
                    ? "border-t-4 border-t-blue-500 pt-1" 
                    : "border-b-4 border-b-blue-500 pb-1") 
                  : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  {typeIcons[event.type]}
                  <h4 className="font-medium">{event.title}</h4>
                </div>
                <div className="drag-handle cursor-move text-gray-400 hover:text-gray-600">
                  <GripVertical className="h-4 w-4" />
                </div>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2 mt-1">{event.description}</p>
              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(event.priority)}`}>
                    {getTranslation(event.priority)}
                  </span>
                  <Badge variant="secondary" className={`text-xs ${getTypeColor(event.type)}`}>
                    {getTranslation(event.type)}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {format(new Date(event.startDate), "MMM dd")} - {format(new Date(event.endDate), "MMM dd")}
                  </span>
                </div>
                <EventFormDialog 
                  initialEvent={event} 
                  mode="edit" 
                  trigger={<button className="text-xs text-blue-500">{t('edit')}</button>} 
                />
              </div>
              
              {isDragging && dragOverEventId === event.id && draggedEventId !== event.id && (
                <div className={`absolute left-0 right-0 ${
                  dragPosition === 0 ? 'top-0' : 'bottom-0'
                } h-1 bg-blue-500 transition-all duration-200 w-full`}></div>
              )}
            </Card>
          ))
        )}
      </div>

      {isFormOpen && editingEvent && (
        <EventFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          initialEvent={editingEvent}
          mode="edit"
        />
      )}
    </div>
  );
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800";
    case "medium":
      return "bg-yellow-100 text-yellow-800";
    case "low":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case "course":
      return "bg-blue-100 text-blue-800";
    case "workshop":
      return "bg-purple-100 text-purple-800";
    case "training":
      return "bg-emerald-100 text-emerald-800";
    case "planning":
      return "bg-amber-100 text-amber-800";
    case "meeting":
      return "bg-pink-100 text-pink-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
} 