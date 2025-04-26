'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GripVertical, X } from 'lucide-react';
import { useTranslation } from '@/utils/translations';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface Lesson {
  id: string;
  title: string;
  description: string;
  duration: number;
  level: string;
}

interface LessonOrderManagerProps {
  selectedLessons: string[];
  onLessonsReordered: (reorderedLessons: string[]) => void;
  onLessonRemoved: (lessonId: string) => void;
  lessons: Lesson[];
}

export function LessonOrderManager({ 
  selectedLessons, 
  onLessonsReordered, 
  onLessonRemoved,
  lessons 
}: LessonOrderManagerProps) {
  const [orderedLessons, setOrderedLessons] = useState<string[]>([]);
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  useEffect(() => {
    setOrderedLessons(selectedLessons);
  }, [selectedLessons]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(orderedLessons);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setOrderedLessons(items);
    onLessonsReordered(items);
  };

  return (
    <div className="mb-3">
      <p className="text-sm font-medium mb-2">{t('selected_lessons')} ({orderedLessons.length}/5):</p>
      <p className="text-xs text-muted-foreground mb-2">{t('drag_to_reorder')}</p>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="lessons">
          {(provided) => (
            <div 
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {orderedLessons.map((lessonId, index) => {
                const lesson = lessons.find(l => l.id === lessonId);
                if (!lesson) return null;
                
                return (
                  <Draggable key={lessonId} draggableId={lessonId} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="flex items-center gap-2 p-2 bg-muted/40 rounded-md border border-muted group"
                      >
                        <div 
                          {...provided.dragHandleProps}
                          className="text-muted-foreground cursor-grab"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          {index + 1}
                        </Badge>
                        
                        <div className="flex-1 truncate">
                          {lesson.title}
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100"
                          onClick={() => onLessonRemoved(lessonId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      
      <div className="mt-2 h-px bg-muted-foreground/20" />
    </div>
  );
} 