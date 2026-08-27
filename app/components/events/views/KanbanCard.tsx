'use client';

import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  GraduationCap,
  BookOpen,
  BarChart2,
  CalendarClock,
  Users
} from "lucide-react";
import { format } from "date-fns";
import { Event, EventType } from "@/contexts/EventContext";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EventFormDialog } from "@/components/events/EventFormDialog";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

const typeIcons: Record<EventType, React.ReactNode> = {
  course: <GraduationCap className="h-3 w-3 text-blue-500" />,
  workshop: <BookOpen className="h-3 w-3 text-purple-500" />,
  training: <BarChart2 className="h-3 w-3 text-emerald-500" />,
  planning: <CalendarClock className="h-3 w-3 text-amber-500" />,
  meeting: <Users className="h-3 w-3 text-pink-500" />,
  other: <Calendar className="h-3 w-3 text-gray-500" />
};

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

interface KanbanCardProps {
  event: Event;
  isOverlay?: boolean;
}

export function KanbanCard({ event, isOverlay = false }: KanbanCardProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: event.id, data: { type: 'card', status: event.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getTranslation = (key: string): string => {
    return language === 'zh-TW' ?
      ({
        'high': '高', 'medium': '中', 'low': '低',
        'course': '課程', 'workshop': '工作坊', 'training': '訓練',
        'planning': '規劃', 'meeting': '會議', 'other': '其他', 'edit': '編輯'
      } as Record<string, string>)[key] || key :
      ({
        'high': 'High', 'medium': 'Medium', 'low': 'Low',
        'course': 'Course', 'workshop': 'Workshop', 'training': 'Training',
        'planning': 'Planning', 'meeting': 'Meeting', 'other': 'Other', 'edit': 'Edit'
      } as Record<string, string>)[key] || key;
  };

  return (
    <>
      <Card
        ref={isOverlay ? undefined : setNodeRef}
        style={isOverlay ? undefined : style}
        {...(isOverlay ? {} : attributes)}
        {...(isOverlay ? {} : listeners)}
        className={`p-3 mb-2 hover:shadow-md relative transition-shadow touch-none ${
          isOverlay ? "shadow-lg rotate-2 cursor-grabbing" : "cursor-grab active:cursor-grabbing"
        } ${isDragging ? "opacity-40" : "opacity-100"}`}
      >
        <div className="flex items-center gap-2 mb-1">
          {typeIcons[event.type]}
          <h4 className="font-medium">{event.title}</h4>
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
          {!isOverlay && (
            <EventFormDialog
              initialEvent={event}
              mode="edit"
              trigger={<button className="text-xs text-blue-500">{t('edit')}</button>}
            />
          )}
        </div>
      </Card>
    </>
  );
}
