'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { BookOpen, GripVertical, X } from 'lucide-react';
import { useTranslation } from '@/utils/translations';
import { useLanguage } from '@/app/contexts/LanguageContext';
import type { GameMission } from '../game-engine/src/types/game';
import { missionLimits } from '../game-engine/src/lib/mission';

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
  mission?: GameMission;
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
  const [missionLessonId, setMissionLessonId] = useState<string | null>(null);
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  useEffect(() => {
    setOrderedLessons(selectedLessons);
  }, [selectedLessons]);

  const missionLesson = missionLessonId ? lessons.find(l => l.id === missionLessonId) : null;
  const missionOverride = missionLessonId ? (lessonOverrides[missionLessonId] ?? {}) : {};
  const hasMissionContent = (override: LessonOverride) =>
    Object.values(override.mission ?? {}).some(value => value?.trim());

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
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={disabled}
                              onClick={() => setMissionLessonId(lessonId)}
                            >
                              <BookOpen className="mr-2 h-3.5 w-3.5" />
                              {language === 'zh-TW' ? '任務情境（選填）' : 'Mission story (optional)'}
                            </Button>
                            {hasMissionContent(override) && (
                              <Badge variant="secondary" className="text-xs">
                                {language === 'zh-TW' ? '已填寫' : 'Filled in'}
                              </Badge>
                            )}
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

      <Dialog open={Boolean(missionLessonId)} onOpenChange={open => !open && setMissionLessonId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{missionLesson?.title}</DialogTitle>
            <DialogDescription>
              {language === 'zh-TW' ? '只套用於這款遊戲，不會改寫原教材、題目或通關條件。留白即可快速套用課程。請勿填入答案或私人資料，這些文字會顯示給學生。' : 'Applies only to this game. Lessons, questions and completion rules stay unchanged. Leave blank to use the lesson directly. Do not include answers or private data; these fields are visible to students.'}
            </DialogDescription>
          </DialogHeader>
          {missionLessonId && missionLesson && (
            <>
              <div className="grid gap-3">
                {([
                  ['scenario', '任務情境', 'Mission scenario', '學生正在幫誰解決什麼問題？'],
                  ['objective', '任務目標', 'Mission objective', '這一關要完成什麼？'],
                  ['mentorMessage', '導師開場白', 'Mentor greeting', '給學生一句開始探索的引導。'],
                  ['completionMessage', '完成回饋', 'Completion message', '任務完成後的回饋；請勿宣稱未經評量的技能精通。'],
                ] as const).map(([key, zh, en, placeholder]) => (
                  <label key={key} className="grid gap-1.5 text-xs font-medium" htmlFor={`mission-${missionLessonId}-${key}`}>
                    <span className="flex justify-between gap-2"><span>{language === 'zh-TW' ? zh : en}</span><span className="font-normal text-muted-foreground">{missionOverride.mission?.[key]?.length || 0}/{missionLimits[key]}</span></span>
                    <textarea id={`mission-${missionLessonId}-${key}`} disabled={disabled} rows={key === 'scenario' ? 3 : 2}
                      className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      maxLength={missionLimits[key]} value={missionOverride.mission?.[key] ?? ''}
                      placeholder={language === 'zh-TW' ? placeholder : en}
                      onChange={event => onLessonOverrideChange(missionLessonId, { mission: { ...missionOverride.mission, [key]: event.target.value } })} />
                  </label>
                ))}
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm">
                <p className="text-xs font-medium text-blue-800">{language === 'zh-TW' ? '學生端任務預覽' : 'Student mission preview'}</p>
                <p className="mt-2 font-semibold break-words">{missionLesson.title}</p>
                <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{missionOverride.mission?.objective?.trim() || missionOverride.cardDescription || missionLesson.description || (language === 'zh-TW' ? '閱讀學習資料，依課程指引完成練習。' : 'Read the learning materials and follow the lesson instructions.')}</p>
                {missionOverride.mission?.scenario?.trim() && <p className="mt-2 whitespace-pre-line break-words">{missionOverride.mission.scenario}</p>}
                {missionOverride.mission?.mentorMessage?.trim() && <p className="mt-2 whitespace-pre-line break-words text-muted-foreground">{language === 'zh-TW' ? '導師：' : 'Mentor: '}{missionOverride.mission.mentorMessage}</p>}
                {missionOverride.mission?.completionMessage?.trim() && <p className="mt-2 whitespace-pre-line break-words text-muted-foreground">{language === 'zh-TW' ? '完成後：' : 'After completion: '}{missionOverride.mission.completionMessage}</p>}
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setMissionLessonId(null)}>{language === 'zh-TW' ? '完成' : 'Done'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
