'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Book, Clock, Users, Grid, List, Pencil, ExternalLink, ChevronDown, ChevronUp, X, Trash2, Wand2, Eye, Edit, Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { LessonDraftPreview } from '@/components/lessons/LessonDraftPreview';
import * as z from 'zod';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import MarkdownEditor from '@/app/components/ui/MarkdownEditor';
import MarkdownRenderer from '@/app/components/ui/MarkdownRenderer';
import { EmptyState, PageLoader } from '@/components/ui/page-state';
import { EditorWorkspace } from '@/components/layout/EditorWorkspace';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { DeleteConfirmation } from '@/components/ui/delete-confirmation';

// A .min(1, message) alone only covers the "too short" Zod issue, which
// requires the value to already BE a string. A genuinely missing/wrong-typed
// value hits "invalid_type" first and falls back to Zod's own built-in
// (English, untranslated) "Required" message instead - passing required_error
// covers that path too, so the translated message is used either way.
function requiredString(message: string) {
  return z.string({ required_error: message }).min(1, message);
}
function requiredNumber(message: string) {
  return z.number({ required_error: message, invalid_type_error: message }).min(1, message);
}

// Heuristic-only: catches a "<name> <number>" token (e.g. "iPhone 16",
// "Excel 2021") repeated with a mismatched number between a question and
// its own answer/explanation - the exact shape of drift a tester hit
// (question said iPhone 16, explanation said iPhone 14). Not exhaustive,
// and never blocks saving - just a nudge to double-check, since a plain
// regex over free text will occasionally misfire on real content.
function modelTokens(text: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const match of Array.from(text.matchAll(/([A-Za-z一-龥]+)\s*(\d+)/g))) tokens.set(match[1], match[2]);
  return tokens;
}
function findContentDrift(question: string, other: string): string | null {
  const questionTokens = modelTokens(question);
  for (const [name, number] of Array.from(modelTokens(other))) {
    const questionNumber = questionTokens.get(name);
    if (questionNumber && questionNumber !== number) return `${name} ${number}`;
  }
  return null;
}

interface PracticeExercise {
  question: string;
  answer: string;
  explanation: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  duration: number;
  level: string;
  topics: string[];
  genially_link: string;
  teaching_content: string;
  practice_exercises: PracticeExercise[];
  created_at: string;
  markdown_content?: string; // 新增 markdown_content 欄位
}

// Helper function to safely parse JSON strings from database
function safeParse(str: string, defaultValue: any = []): any {
  try {
    return JSON.parse(str);
  } catch (error) {
    console.error('Error parsing JSON string:', error);
    return defaultValue;
  }
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Lesson | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [practiceExercises, setPracticeExercises] = useState<PracticeExercise[]>([
    { question: "", answer: "", explanation: "" }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const [expandedLessons, setExpandedLessons] = useState<{ [key: string]: boolean }>({});
  const [expandedExercises, setExpandedExercises] = useState<{ [key: string]: boolean }>({});
  const [showEditForm, setShowEditForm] = useState(false);
  const [lessonSearch, setLessonSearch] = useState('');
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [markdownEditorMode, setMarkdownEditorMode] = useState<'edit' | 'preview'>('edit');
  const markdownTexts = useMemo(() => ({
    label: t('markdown_label'),
    placeholder: t('markdown_placeholder'),
    edit: t('markdown_edit'),
    preview: t('markdown_preview'),
    empty: t('markdown_empty'),
  }), [t]);

  // Simple UUID v4/standard validator (accepts hyphenated 36-char string)
  function isUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  // Which field the error-summary links should jump to and focus - the
  // first invalid field in that section, not just "somewhere in there".
  function firstBasicsErrorField(errors: typeof form.formState.errors) {
    return (['title', 'cardDescription', 'duration', 'level', 'topics', 'geniallyLink'] as const)
      .find((key) => errors[key]) ?? null;
  }
  function firstPracticeErrorField(errors: typeof form.formState.errors): string | null {
    if (errors.teachingContent) return 'teachingContent';
    const practiceErrors = errors.practiceExercises;
    if (Array.isArray(practiceErrors)) {
      for (let index = 0; index < practiceErrors.length; index++) {
        const exerciseError = practiceErrors[index] as Record<string, unknown> | null | undefined;
        if (!exerciseError) continue;
        const field = (['question', 'answer', 'explanation'] as const).find((key) => exerciseError[key]);
        if (field) return `practiceExercises.${index}.${field}`;
      }
    }
    return practiceErrors ? 'practiceExercises' : null;
  }

  // Form schema with translated validation messages
  const lessonFormSchema = z.object({
    title: requiredString(t('required_title')),
    cardDescription: requiredString(t('required_lesson_card_summary')).max(160, t('lesson_card_summary_too_long')),
    markdownContent: requiredString(t('required_content')),
    duration: requiredNumber(t('duration') + t('field_required')),
    level: requiredString(t('level') + t('field_required')),
    topics: requiredString(t('required_topics')),
    geniallyLink: z.union([z.string().url(t('enter_genially_url')), z.literal('')]).optional(),
    // No .min(1) here on purpose: only the "生成練習題" button actually
    // needs this field, and it has its own guard (below) before calling
    // Gemini. A teacher who writes every question by hand should be able
    // to save without ever touching it. Left as a plain (non-optional)
    // string, not .optional(), since the field is always a controlled
    // string ("" by default) and LessonEditorValues expects it as such.
    teachingContent: z.string(),
    // Each field gets its own message (not the array-level "at least one
    // exercise" text reused as a suffix, which read as a non-sequitur -
    // e.g. "Question at least one practice exercise is required").
    practiceExercises: z.array(z.object({
      question: requiredString(t('question') + t('field_required')),
      answer: requiredString(t('answer') + t('field_required')),
      explanation: requiredString(t('explanation') + t('field_required')),
    })).min(1, t('exercise_required'))
  });

  // 使用useMemo緩存轉換函數的結果
  const translatedLevels = useMemo(() => ({
    beginner: t('beginner'),
    intermediate: t('intermediate'),
    advanced: t('advanced')
  }), [t]);
  
  // Form setup
  const form = useForm<z.infer<typeof lessonFormSchema>>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: {
      title: "",
      cardDescription: "",
      markdownContent: "",
      duration: 30,
      level: "Beginner",
      topics: "",
      geniallyLink: "",
      teachingContent: "",
      practiceExercises: [{ question: "", answer: "", explanation: "" }]
    }
  });

  const confirmLeave = useUnsavedChanges(showEditForm && form.formState.isDirty, showEditForm && (form.formState.isSubmitting || isGenerating));
  const closeEditor = () => {
    if (!confirmLeave()) return;
    setShowEditForm(false);
    setEditingLesson(null);
    form.reset();
    setPracticeExercises([{ question: '', answer: '', explanation: '' }]);
  };

  useEffect(() => {
    const fetchLessons = async () => {
      if (!isLoading) setIsLoading(true);
      try {
        console.log("Fetching lessons from lessons table");
        
        // 動態導入 supabase 函數
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();
        
        // 使用 as any 臨時解決類型問題
        const supabaseWithTypes = supabaseClient as any;
        
        const { data, error } = await supabaseWithTypes
          .from('lessons')
          .select('*');
          
        if (error) {
          throw error;
        }
        
        if (data && data.length > 0) {
          // Ensure all lessons have the expected structure
          const processedData = data.map(lesson => ({
            ...lesson,
            topics: Array.isArray(lesson.topics) ? lesson.topics : 
                   (typeof lesson.topics === 'string' ? JSON.parse(lesson.topics || '[]') : []),
            duration: lesson.duration || 0,
            level: lesson.level || 'Beginner',
            genially_link: lesson.genially_link || '',
            teaching_content: lesson.teaching_content || '',
            practice_exercises: Array.isArray(lesson.practice_exercises) ? lesson.practice_exercises : 
                               (typeof lesson.practice_exercises === 'string' && lesson.practice_exercises ? 
                                JSON.parse(lesson.practice_exercises) : [])
          }));
          setLessons(processedData);
        } else {
          // 如果沒有數據，使用空數組而不是示例數據
          setLessons([]);
        }
      } catch (error) {
        toast({
          title: t('lesson_error'),
          description: t('lesson_error_fetch'),
          variant: 'destructive',
        });
        console.error('Error fetching lessons:', error);
        
        // 使用空數組而不是示例數據
        setLessons([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLessons();
    // 只在組件掛載時獲取數據，避免不必要的重新獲取
  }, []);

  useEffect(() => {
    if (editingLesson) {
      form.reset({
        title: editingLesson.title,
        cardDescription: editingLesson.description || '',
        markdownContent: editingLesson.markdown_content || '',
        duration: editingLesson.duration,
        level: editingLesson.level,
        topics: editingLesson.topics.join(', '),
        geniallyLink: editingLesson.genially_link,
        teachingContent: editingLesson.teaching_content,
        practiceExercises: editingLesson.practice_exercises?.length ? editingLesson.practice_exercises.map(item => ({ ...item })) : [{ question: "", answer: "", explanation: "" }]
      });
      // Ensure we have at least one practice exercise when editing
      if (editingLesson.practice_exercises && editingLesson.practice_exercises.length > 0) {
        setPracticeExercises(editingLesson.practice_exercises.map(item => ({ ...item })));
      } else {
        setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
      }
    }
  }, [editingLesson, form]);

  // Add a practice exercise
  const addPracticeExercise = () => {
    const updated = [...practiceExercises, { question: "", answer: "", explanation: "" }];
    setPracticeExercises(updated);
    form.setValue('practiceExercises', updated, { shouldDirty: true });
  };

  // Remove a practice exercise
  const removePracticeExercise = (index: number) => {
    // Make sure practiceExercises exists and has more than one item
    if (practiceExercises && practiceExercises.length > 1) {
      const updatedExercises = practiceExercises.map(item => ({ ...item }));
      updatedExercises.splice(index, 1);
      setPracticeExercises(updatedExercises);
      form.setValue('practiceExercises', updatedExercises, { shouldDirty: true, shouldValidate: true });
    }
  };

  // Update practice exercises safely
  const updatePracticeExercise = (index: number, field: 'question' | 'answer' | 'explanation', value: string) => {
    if (!practiceExercises) {
      setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
      return;
    }
    
    const updatedExercises = practiceExercises.map(item => ({ ...item }));
    if (!updatedExercises[index]) {
      updatedExercises[index] = { question: "", answer: "", explanation: "" };
    }
    updatedExercises[index][field] = value;
    setPracticeExercises(updatedExercises);
    form.setValue('practiceExercises', updatedExercises, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (values: z.infer<typeof lessonFormSchema>) => {
    try {
      // 動態導入 supabase 函數
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      // 使用 as any 臨時解決類型問題
      const supabaseWithTypes = supabaseClient as any;
      
      // Convert topics string to array
      const topicsArray = values.topics.split(/[,，]/).map(topic => topic.trim());
      
      // Basic lesson data that should work with any schema
      const basicLessonData = {
        title: values.title,
        duration: values.duration,
        level: values.level,
        // Topics might need to be stored as a string in some DB schemas
        topics: topicsArray,
        // Keep description for backward-compat or DB constraints
        description: values.cardDescription.trim(),
      } as any;

      // Create a JSON-friendly version of the data for storage
      const jsonExtras = {
        genially_link: values.geniallyLink || '',
        teaching_content: values.teachingContent,
        practice_exercises: practiceExercises,
        markdown_content: values.markdownContent || '',
        card_description: values.cardDescription.trim(),
      };

      // Store extended data as JSON in 'metadata' field if it exists
      // or try each field individually
      let lessonData: any = {
        ...basicLessonData,
        // Try both approaches - if the columns exist, they'll be used
        // If not, the error handling below will catch it
        genially_link: values.geniallyLink || '',
        teaching_content: values.teachingContent,
        practice_exercises: practiceExercises,
        markdown_content: values.markdownContent || '',
        // Also try a metadata field that might exist
        metadata: jsonExtras
      };

      if (editingLesson) {
        // First try updating with all fields
        let response = await supabaseWithTypes
          .from('lessons')
          .update(lessonData)
          .eq('id', editingLesson.id);

        if (response.error) throw response.error;

        // For client-side state, use the full data model
        const updatedLesson = {
          ...editingLesson,
          ...basicLessonData,
          genially_link: values.geniallyLink || '',
          teaching_content: values.teachingContent,
          practice_exercises: practiceExercises,
          markdown_content: values.markdownContent || '', // 添加markdown_content欄位
        };
        
        // Update the lesson in state
        setLessons(prev => prev.map(lesson => 
          lesson.id === editingLesson.id ? updatedLesson : lesson
        ));

        toast({
          title: t('lesson_updated'),
          description: t('lesson_update_success')
        });
        
        setShowEditForm(false);
      } else {
        // Handle creation - add created_at field
        const fullData = {
          ...lessonData,
          created_at: new Date().toISOString()
        };
        
        // First try inserting with all fields and return inserted row
        let response = await supabaseWithTypes
          .from('lessons')
          .insert([fullData])
          .select('*')
          .single();

        // If there's an error that might be due to missing columns
        if (response.error && response.error.message.includes('column') && response.error.message.includes('does not exist')) {
          console.warn('Encountered schema mismatch, trying with basic fields only:', response.error);
          
          // Try again with just the basic fields
          const basicData = {
            ...basicLessonData,
            created_at: new Date().toISOString()
          };
          
          response = await supabaseWithTypes
            .from('lessons')
            .insert([basicData])
            .select('*')
            .single();
            
          if (response.error) {
            console.error('Failed even with basic fields:', response.error);
            throw response.error;
          }
        } else if (response.error) {
          throw response.error;
        }
        
        // Build client-side lesson from returned row to keep UUID id
        const inserted = response.data;
        const processedInserted: Lesson = {
          id: inserted.id,
          title: inserted.title,
          description: inserted.description ?? values.cardDescription.trim(),
          duration: inserted.duration ?? basicLessonData.duration,
          level: inserted.level ?? basicLessonData.level,
          topics: Array.isArray(inserted.topics) ? inserted.topics : (typeof inserted.topics === 'string' ? safeParse(inserted.topics, []) : []),
          genially_link: inserted.genially_link || values.geniallyLink || '',
          teaching_content: inserted.teaching_content || values.teachingContent,
          practice_exercises: Array.isArray(inserted.practice_exercises) ? inserted.practice_exercises : (typeof inserted.practice_exercises === 'string' ? safeParse(inserted.practice_exercises, []) : practiceExercises),
          created_at: inserted.created_at || new Date().toISOString(),
          markdown_content: inserted.markdown_content || values.markdownContent || ''
        } as Lesson;

        // Add the new lesson to the state
        setLessons(prev => [...prev, processedInserted]);
        
        toast({
          title: t('lesson_created'),
          description: t('lesson_create_success')
        });
        
        setShowEditForm(false);
      }
      
      setEditingLesson(null);
      form.reset();
      setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
    } catch (error: any) {
      console.error('Error saving lesson:', error);
      toast({
        title: `${t(editingLesson ? 'lesson_error_update' : 'lesson_error_create')}`,
        description: error.message || t('try_again'),
        variant: 'destructive'
      });
    }
  };

  // Add delete lesson function after the onSubmit function
  const deleteLesson = async (lessonId: string) => {
    if (isDeleting) return;
    try {
      setIsDeleting(true);
      
      // 動態導入 supabase 函數
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      // 使用 as any 臨時解決類型問題
      const supabaseWithTypes = supabaseClient as any;
      
      // Never guess a destructive target using non-unique titles.
      if (!isUuid(lessonId)) throw new Error('Invalid lesson ID; refresh the list before deleting.');

      // Delete the lesson from Supabase using UUID id
      const { error } = await supabaseWithTypes
        .from('lessons')
        .delete()
        .eq('id', lessonId);
        
      if (error) {
        // Ensure error has a readable message
        throw new Error(error.message || JSON.stringify(error));
      }
      
      // Remove the lesson from the local state
      setLessons(lessons.filter(lesson => lesson.id !== lessonId));
      setDeleteTarget(null);
      
      toast({
        title: t('lesson_deleted'),
        description: t('lesson_delete_success'),
      });
    } catch (error: any) {
      toast({
        title: t('lesson_error_delete'),
        description: (error && (error.message || error.hint || error.details)) || t('lesson_error_delete_msg'),
        variant: 'destructive',
      });
      try {
        console.error('Error deleting lesson:', error?.message || error, error);
      } catch {
        console.error('Error deleting lesson (stringified):', String(error));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  function getLevelColor(level: string) {
    switch (level.toLowerCase()) {
      case 'beginner':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'intermediate':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'advanced':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }

  // Function to translate level text with memoized translations
  function translateLevel(level: string) {
    const lowerLevel = level.toLowerCase();
    return lowerLevel === 'beginner' ? translatedLevels.beginner :
           lowerLevel === 'intermediate' ? translatedLevels.intermediate :
           lowerLevel === 'advanced' ? translatedLevels.advanced :
           level;
  }

  const toggleLessonExpand = (lessonId: string) => {
    setExpandedLessons(prev => ({
      ...prev,
      [lessonId]: !prev[lessonId]
    }));
  };

  const toggleExerciseAnswer = (exerciseId: string) => {
    setExpandedExercises(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId]
    }));
  };

  const normalizedLessonSearch = lessonSearch.trim().toLowerCase();
  const visibleLessons = lessons.filter((lesson) =>
    !normalizedLessonSearch
    || lesson.title.toLowerCase().includes(normalizedLessonSearch)
    || lesson.description?.toLowerCase().includes(normalizedLessonSearch)
    || lesson.topics?.some((topic) => topic.toLowerCase().includes(normalizedLessonSearch))
  );

  return (
    <div className="space-y-6">
      <DeleteConfirmation name={deleteTarget?.title ?? null} busy={isDeleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) void deleteLesson(deleteTarget.id); }} />
      <PageHeader
        heading={t('lessons')}
        text={t('manage_lessons')}
        actions={
          <div className="flex space-x-2">
            <div className="bg-muted rounded-md p-1 flex">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-2.5"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
                <span className="sr-only">{t('grid_view')}</span>
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-2.5"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
                <span className="sr-only">{t('list_view')}</span>
              </Button>
            </div>
            {!showEditForm && (
              <Button 
                onClick={() => {
                  setEditingLesson(null);
                  setShowEditForm(true);
                  setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
                  form.reset({
                    title: "",
                    markdownContent: "",
                    duration: 30,
                    level: "Beginner",
                    topics: "",
                    geniallyLink: "",
                    teachingContent: "",
                    practiceExercises: [{ question: "", answer: "", explanation: "" }]
                  });
                }}
              >
            <PlusCircle className="mr-2 h-4 w-4" />
            {t('create_lesson')}
          </Button>
            )}
          </div>
        }
      />

      {!showEditForm && !isLoading && (
        <div className="app-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={lessonSearch}
              onChange={(event) => setLessonSearch(event.target.value)}
              placeholder={language === 'zh-TW' ? '搜尋課程、摘要或主題' : 'Search lessons, summaries or topics'}
              className="pl-9"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {language === 'zh-TW' ? `顯示 ${visibleLessons.length} / ${lessons.length} 堂課程` : `Showing ${visibleLessons.length} of ${lessons.length} lessons`}
          </span>
        </div>
      )}
      
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="content-transition">
          {showEditForm ? (
            <div className="min-h-[60vh]">
              <EditorWorkspace
                title={editingLesson ? t('edit_lesson') : t('create_lesson')}
                description={language === 'zh-TW' ? '依序完成基本資料、教材內容與練習題。' : 'Complete the basics, lesson content and practice exercise in order.'}
                sections={[
                  { id: 'lesson-basics', label: language === 'zh-TW' ? '基本資料' : 'Basics' },
                  { id: 'lesson-content', label: language === 'zh-TW' ? '教材內容' : 'Content' },
                  { id: 'lesson-practice', label: language === 'zh-TW' ? '練習題' : 'Practice' },
                ]}
                actions={<>
                  <span role="status" className="text-xs text-muted-foreground">{form.formState.isDirty ? (language === 'zh-TW' ? '有未儲存的變更' : 'Unsaved changes') : (language === 'zh-TW' ? '尚無變更' : 'No changes')}</span>
                  <Button variant="outline" size="sm" disabled={form.formState.isSubmitting || isGenerating} onClick={closeEditor}>{t('cancel')}</Button>
                  <Button type="submit" form="lesson-editor-form" disabled={form.formState.isSubmitting || isGenerating}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {form.formState.isSubmitting ? (language === 'zh-TW' ? '儲存中…' : 'Saving…') : editingLesson ? t('save_changes') : t('create_lesson')}
                  </Button>
                </>}
              />
              
              <LessonDraftPreview control={form.control} />

              <Card className="shadow-none">
                <CardContent className="pt-5 md:pt-6">
              <Form {...form}>
                <form id="lesson-editor-form" onSubmit={form.handleSubmit(onSubmit)} aria-busy={form.formState.isSubmitting}>
                  {Object.keys(form.formState.errors).length > 0 && (() => {
                    const basicsField = firstBasicsErrorField(form.formState.errors);
                    const practiceField = firstPracticeErrorField(form.formState.errors);
                    // Clicking jumps to AND focuses the first invalid field in that
                    // section (form.setFocus scrolls the input into view itself),
                    // instead of just landing somewhere near the top of the section.
                    return (
                      <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                        <p className="font-medium">{language === 'zh-TW' ? '尚有欄位需要修正，請檢查以下區塊：' : 'Please check these sections before saving:'}</p>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {basicsField && (
                            <a href="#lesson-basics" className="underline" onClick={(event) => { event.preventDefault(); form.setFocus(basicsField); }}>
                              {language === 'zh-TW' ? '基本資料' : 'Basics'}
                            </a>
                          )}
                          {form.formState.errors.markdownContent && (
                            <a href="#lesson-content" className="underline" onClick={(event) => { event.preventDefault(); form.setFocus('markdownContent'); }}>
                              {language === 'zh-TW' ? '教材內容' : 'Content'}
                            </a>
                          )}
                          {practiceField && (
                            <a href="#lesson-practice" className="underline" onClick={(event) => { event.preventDefault(); form.setFocus(practiceField as any); }}>
                              {language === 'zh-TW' ? '練習題' : 'Practice'}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <fieldset disabled={form.formState.isSubmitting} className="space-y-4 min-w-0">
                  <section id="lesson-basics" className="scroll-mt-24 lg:scroll-mt-64 space-y-4 rounded-xl border border-border/70 p-4 sm:p-5">
                    <div>
                      <h3 className="font-semibold">{language === 'zh-TW' ? '基本資料' : 'Lesson basics'}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{language === 'zh-TW' ? '設定學生在列表中會先看到的資訊。' : 'Set the information students see first in the lesson list.'}</p>
                    </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>{t('title')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('enter_lesson_title')} {...field} />
                          </FormControl>
                          {form.formState.errors.title && (
                            <p className="text-sm font-medium text-destructive">{t('required_title')}</p>
                          )}
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="duration"
                        render={({ field }: { field: any }) => (
                          <FormItem>
                            <FormLabel>{t('duration')} ({t('minutes')})</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="level"
                        render={({ field }: { field: any }) => (
                          <FormItem>
                            <FormLabel>{t('level')}</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t('select_level')} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Beginner">{t('beginner')}</SelectItem>
                                <SelectItem value="Intermediate">{t('intermediate')}</SelectItem>
                                <SelectItem value="Advanced">{t('advanced')}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="cardDescription"
                    render={({ field }: { field: any }) => (
                      <FormItem>
                        <FormLabel>{t('lesson_card_summary')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('lesson_card_summary_placeholder')}
                            className="min-h-20"
                            maxLength={160}
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {t('lesson_card_summary_help')} · {field.value?.length ?? 0}/160
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="topics"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>{t('topics')} ({t('comma_separated')})</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={t('topics_placeholder')}
                              {...field} 
                            />
                          </FormControl>
                          {form.formState.errors.topics && (
                            <p className="text-sm font-medium text-destructive">{t('required_topics')}</p>
                          )}
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="geniallyLink"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel>{t('genially_link')}</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={t('enter_genially_url')}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  </section>
                  
                  {/* Markdown 內容編輯區塊 */}
                  <section id="lesson-content" className="scroll-mt-24 lg:scroll-mt-64 space-y-4 rounded-xl border border-border/70 p-4 sm:p-5">
                    <div>
                      <h3 className="font-semibold">{language === 'zh-TW' ? '教材內容' : 'Lesson content'}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{language === 'zh-TW' ? '撰寫完整教學內容，並可隨時切換預覽。' : 'Write the full lesson and switch to preview at any time.'}</p>
                    </div>
                  <FormField
                    control={form.control}
                    name="markdownContent"
                    render={({ field }: { field: any }) => (
                      <FormItem>
                        <div className="flex items-center justify-between mb-2">
                          <FormLabel>{markdownTexts.label}</FormLabel>
                          <div className="flex space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMarkdownEditorMode('edit')}
                              className={markdownEditorMode === 'edit' ? 'bg-primary text-primary-foreground' : ''}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              {markdownTexts.edit}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMarkdownEditorMode('preview')}
                              className={markdownEditorMode === 'preview' ? 'bg-primary text-primary-foreground' : ''}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {markdownTexts.preview}
                            </Button>
                          </div>
                        </div>
                        <FormControl>
                          <div className="border rounded-md relative z-10">
                            {markdownEditorMode === 'edit' ? (
                              <div className="md:max-w-full overflow-x-auto">
                                <MarkdownEditor
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  placeholder={markdownTexts.placeholder}
                                />
                              </div>
                            ) : (
                              <div className="p-4 min-h-[300px] max-h-[500px] overflow-y-auto bg-white">
                                {field.value ? (
                                  <MarkdownRenderer content={field.value} />
                                ) : (
                                  <div className="text-muted-foreground italic">
                                    {markdownTexts.empty}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </FormControl>
                        {form.formState.errors.markdownContent && (
                          <p className="text-sm font-medium text-destructive">{t('required_content')}</p>
                        )}
                      </FormItem>
                    )}
                  />
                  </section>

                  <section id="lesson-practice" className="scroll-mt-24 lg:scroll-mt-64 space-y-4 rounded-xl border border-border/70 p-4 sm:p-5">
                    <div>
                      <h3 className="font-semibold">{language === 'zh-TW' ? '練習題' : 'Practice exercise'}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{language === 'zh-TW' ? '建立可檢核學習成果的題目、答案與解析。' : 'Add a question, answer and explanation to check learning.'}</p>
                    </div>
                  <FormField
                    control={form.control}
                    name="teachingContent"
                    render={({ field }: { field: any }) => (
                      <FormItem>
                        <FormLabel>{t('create_exercise')}</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={t('enter_teaching_summary')}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="bg-black text-white hover:bg-black/90 transition-all duration-200 flex items-center"
                      disabled={isGenerating || form.formState.isSubmitting}
                      onClick={async () => {
                        const content = form.getValues("teachingContent");
                        const level = form.getValues("level");
                        if (!content) {
                          toast({
                            title: t('content_required'),
                            description: t('enter_teaching_content_first'),
                            variant: "destructive",
                          });
                          return;
                        }

                        setIsGenerating(true);

                        try {
                          const response = await fetch('/api/gemini/practice-exercise', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content, level }),
                          });
                          if (!response.ok) {
                            throw new Error('Failed to generate practice exercise');
                          }
                          const exercise = await response.json();
                          const current = form.getValues('practiceExercises');
                          const updated = current.length === 1 && !Object.values(current[0]).some(Boolean) ? [exercise] : [...current, exercise];
                          setPracticeExercises(updated);
                          form.setValue("practiceExercises", updated, { shouldDirty: true, shouldValidate: true });
                        } catch (error) {
                          toast({
                            title: t('generation_failed'),
                            description: t('failed_generate_exercise'),
                            variant: "destructive",
                          });
                        } finally {
                          setIsGenerating(false);
                        }
                      }}
                    >
                      {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                      {isGenerating ? (
                        <span className="inline-flex items-center">
                          {t('generating')}
                        </span>
                      ) : (
                        t('generate_exercise')
                      )}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-medium">{t('practice_exercises')} · {practiceExercises.length}</h4>
                      <Button type="button" variant="outline" onClick={addPracticeExercise}><PlusCircle className="mr-2 h-4 w-4" />{language === 'zh-TW' ? '新增題目' : 'Add exercise'}</Button>
                    </div>
                    {practiceExercises.map((exercise, index) => (
                      <div key={index} className="space-y-4 rounded-xl border bg-muted/20 p-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-semibold">{language === 'zh-TW' ? `練習 ${index + 1}` : `Exercise ${index + 1}`}</h5>
                          <Button type="button" variant="ghost" size="sm" disabled={practiceExercises.length === 1 || isGenerating} onClick={() => removePracticeExercise(index)} aria-label={language === 'zh-TW' ? `刪除練習 ${index + 1}` : `Remove exercise ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        {(['question', 'answer', 'explanation'] as const).map(key => (
                          <div key={key} className="space-y-2">
                            <label htmlFor={`exercise-${index}-${key}`} className="text-sm font-medium">{t(key)}</label>
                            <Textarea id={`exercise-${index}-${key}`} value={exercise[key]} onChange={event => updatePracticeExercise(index, key, event.target.value)} aria-invalid={!!form.formState.errors.practiceExercises?.[index]?.[key]} aria-describedby={form.formState.errors.practiceExercises?.[index]?.[key] ? `exercise-${index}-${key}-error` : undefined} />
                            {form.formState.errors.practiceExercises?.[index]?.[key] && <p id={`exercise-${index}-${key}-error`} className="text-sm text-destructive">{form.formState.errors.practiceExercises[index]?.[key]?.message}</p>}
                          </div>
                        ))}
                        {(() => {
                          const drift = findContentDrift(exercise.question, exercise.explanation) ?? findContentDrift(exercise.question, exercise.answer);
                          return drift ? (
                            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                              {t('exercise_content_drift', { term: drift })}
                            </p>
                          ) : null;
                        })()}
                      </div>
                    ))}
                  </div>
                  </section>
                  
                  <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t bg-card/95 py-4 backdrop-blur">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={closeEditor}
                    >
                      {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={form.formState.isSubmitting || isGenerating}>
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {form.formState.isSubmitting ? (language === 'zh-TW' ? '儲存中…' : 'Saving…') : editingLesson ? t('save_changes') : t('create_lesson')}
                    </Button>
                  </div>
                  </fieldset>
                </form>
              </Form>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div>
              {visibleLessons.length === 0 && (
                <EmptyState
                  title={lessons.length === 0
                    ? (language === 'zh-TW' ? '尚未建立課程' : 'No lessons yet')
                    : t('no_results_found')}
                  description={lessons.length === 0
                    ? (language === 'zh-TW' ? '建立第一堂課程，開始安排教學內容與練習。' : 'Create your first lesson to start organizing content and exercises.')
                    : (language === 'zh-TW' ? '請調整搜尋關鍵字後再試一次。' : 'Adjust your search and try again.')}
                  icon={Book}
                  action={lessons.length > 0 ? (
                    <Button variant="outline" onClick={() => setLessonSearch('')}>{language === 'zh-TW' ? '清除搜尋' : 'Clear search'}</Button>
                  ) : undefined}
                />
              )}
              {/* Grid View */}
              {visibleLessons.length > 0 && viewMode === 'grid' && (
                <div className="grid min-h-[60vh] gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visibleLessons.map((lesson) => (
                    <Card key={lesson.id} className="flex min-h-[15rem] h-full flex-col shadow-none transition-colors hover:border-foreground/25">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xl">{lesson.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {lesson.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Clock className="h-4 w-4" />
                          <span>{lesson.duration}{t('minutes')}</span>
                        </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {Array.isArray(lesson.topics) ? lesson.topics.map((topic) => (
                    <Badge key={topic} variant="outline" className="bg-muted/50">
                      {topic}
                    </Badge>
                  )) : null}
                </div>
                <Badge variant="outline" className={getLevelColor(lesson.level)}>
                  {translateLevel(lesson.level)}
                </Badge>
                        {lesson.genially_link && (
                          <div className="mt-3 text-sm text-blue-600">
                            <a href={lesson.genially_link} target="_blank" rel="noopener noreferrer" className="flex items-center hover:underline">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              {t('view_presentation')}
                            </a>
                          </div>
                        )}
              </CardContent>
                      <CardFooter className="bg-muted/50 pt-3 mt-auto">
                <div className="flex w-full justify-between">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:bg-destructive/10" 
                    onClick={() => setDeleteTarget(lesson)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t('delete')}
                  </Button>
                          <div className="flex space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingLesson(lesson);
                                setShowEditForm(true);
                                setPracticeExercises(lesson.practice_exercises && lesson.practice_exercises.length > 0 
                                  ? [lesson.practice_exercises[0]] 
                                  : [{ question: "", answer: "", explanation: "" }]);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              {t('edit')}
                            </Button>
                          </div>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
              )}
              
              {/* List View */}
              {visibleLessons.length > 0 && viewMode === 'list' && (
                <div className="min-h-[60vh] space-y-3">
                  {visibleLessons.map((lesson) => (
                    <Card key={lesson.id} className="min-h-[6rem] shadow-none transition-colors hover:border-foreground/25">
                      <div className="p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-medium mr-2">{lesson.title}</h3>
                              <Badge variant="outline" className={getLevelColor(lesson.level)}>
                                {translateLevel(lesson.level)}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground line-clamp-2">
                              {lesson.description}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {/* Duration */}
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Clock className="h-4 w-4 mr-1" />
                              <span>{lesson.duration}{t('minutes')}</span>
                            </div>

                            {/* Edit button */}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setEditingLesson(lesson);
                                setShowEditForm(true);
                                setPracticeExercises(lesson.practice_exercises && lesson.practice_exercises.length > 0 
                                  ? [lesson.practice_exercises[0]] 
                                  : [{ question: "", answer: "", explanation: "" }]);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              {t('edit')}
                            </Button>

                            {/* Delete button */}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:bg-destructive/10" 
                              onClick={() => setDeleteTarget(lesson)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {t('delete')}
                            </Button>
                          </div>
                        </div>
                        
                        {/* Expanded details section removed since we now have a view details button */}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
