'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  disabled?: boolean;
  selectedLessons: string[];
  onLessonsReordered: (reorderedLessons: string[]) => void;
  onLessonRemoved: (lessonId: string) => void;
  lessons: Lesson[];
  lessonOverrides: Record<string, LessonOverride>;
  onLessonOverrideChange: (lessonId: string, override: Partial<LessonOverride>) => void;
}

export interface LessonOverride {
  number?: number;
  role?: 'intro' | 'standard' | 'final';
  cardDescription?: string;
}

export function LessonOrderManager({ 
  selectedLessons, 
  onLessonsReordered, 
  onLessonRemoved,
  lessons,
  lessonOverrides,
  onLessonOverrideChange,
  disabled = false,
}: LessonOrderManagerProps) {
  const [orderedLessons, setOrderedLessons] = useState<string[]>([]);
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  useEffect(() => {
    setOrderedLessons(selectedLessons);
  }, [selectedLessons]);

  const handleDragEnd = (result: any) => {
    if (disabled || !result.destination) return;
    
    const items = Array.from(orderedLessons);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setOrderedLessons(items);
    onLessonsReordered(items);
  };

  return (
    <div className="mb-3">
      <p className="text-sm font-medium mb-2">{t('selected_lessons')} ({orderedLessons.length}):</p>
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
                const override = lessonOverrides[lessonId] ?? {};
                
                return (
                  <Draggable key={lessonId} draggableId={lessonId} index={index} isDragDisabled={disabled}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="flex items-start gap-2 p-3 bg-muted/40 rounded-md border border-muted group"
                      >
                        <div 
                          {...provided.dragHandleProps}
                          className="text-muted-foreground cursor-grab"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          {override.number ?? index + 1}
                        </Badge>
                        
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="font-medium truncate">{lesson.title}</div>
                          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                            <select
                              disabled={disabled}
                              value={override.role ?? 'standard'}
                              onChange={(event) => onLessonOverrideChange(lessonId, {
                                role: event.target.value as LessonOverride['role'],
                              })}
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                              aria-label={t('lesson_role')}
                            >
                              <option value="intro">{t('lesson_role_intro')}</option>
                              <option value="standard">{t('lesson_role_standard')}</option>
                              <option value="final">{t('lesson_role_final')}</option>
                            </select>
                            <Input
                              disabled={disabled}
                              value={override.cardDescription ?? lesson.description}
                              onChange={(event) => onLessonOverrideChange(lessonId, {
                                cardDescription: event.target.value,
                              })}
                              maxLength={160}
                              placeholder={t('lesson_card_summary_placeholder')}
                              aria-label={t('lesson_card_summary')}
                            />
                          </div>
                        </div>
                        
                        <Button 
                          type="button"
                          disabled={disabled}
                          aria-label={`${t('delete')}: ${lesson.title}`}
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onLessonRemoved(lessonId);
                          }}
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
