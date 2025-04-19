'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Book, Clock, Users, Grid, List, Pencil, ExternalLink, ChevronDown, ChevronUp, X, Trash2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { generatePracticeExercise } from '@/lib/gemini';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

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
}

// Helper function to safely stringify objects for database storage
function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.error('Error stringifying object:', error);
    return '[]';
  }
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

// Add the keyframes style to the document
const style = document.createElement('style');
style.textContent = `
  @keyframes dots {
    0%, 20% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
  }
  
  .content-transition {
    transition: opacity 0.3s ease-in-out;
  }
  
  .content-enter {
    opacity: 0;
  }
  
  .content-enter-active {
    opacity: 1;
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
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
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  // Form schema with translated validation messages
  const lessonFormSchema = z.object({
    title: z.string().min(1, t('title') + " " + t('exercise_required')),
    description: z.string().min(1, t('description') + " " + t('exercise_required')),
    duration: z.number().min(1, t('duration') + " " + t('exercise_required')),
    level: z.string().min(1, t('level') + " " + t('exercise_required')),
    topics: z.string().min(1, t('topics') + " " + t('exercise_required')),
    geniallyLink: z.string().url(t('enter_genially_url')).optional(),
    teachingContent: z.string().min(1, t('create_exercise') + " " + t('exercise_required')),
    practiceExercises: z.array(z.object({
      question: z.string().min(1, t('question') + " " + t('exercise_required')),
      answer: z.string().min(1, t('answer') + " " + t('exercise_required')),
      explanation: z.string().min(1, t('explanation') + " " + t('exercise_required'))
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
      description: "",
      duration: 30,
      level: "Beginner",
      topics: "",
      geniallyLink: "",
      teachingContent: "",
      practiceExercises: [{ question: "", answer: "", explanation: "" }]
    }
  });

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
        // 使用setTimeout略微延遲清除加載狀態，以便避免內容閃爍
        setTimeout(() => {
          setIsLoading(false);
        }, 100);
      }
    };

    fetchLessons();
    // 只在組件掛載時獲取數據，避免不必要的重新獲取
  }, []);

  useEffect(() => {
    if (editingLesson) {
      form.reset({
        title: editingLesson.title,
        description: editingLesson.description,
        duration: editingLesson.duration,
        level: editingLesson.level,
        topics: editingLesson.topics.join(', '),
        geniallyLink: editingLesson.genially_link,
        teachingContent: editingLesson.teaching_content,
        practiceExercises: editingLesson.practice_exercises || []
      });
      // Ensure we have at least one practice exercise when editing
      if (editingLesson.practice_exercises && editingLesson.practice_exercises.length > 0) {
        setPracticeExercises([editingLesson.practice_exercises[0]]);
      } else {
        setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
      }
    }
  }, [editingLesson, form]);

  // Add a practice exercise
  const addPracticeExercise = () => {
    setPracticeExercises([...practiceExercises, { question: "", answer: "", explanation: "" }]);
  };

  // Remove a practice exercise
  const removePracticeExercise = (index: number) => {
    // Make sure practiceExercises exists and has more than one item
    if (practiceExercises && practiceExercises.length > 1) {
      const updatedExercises = [...practiceExercises];
      updatedExercises.splice(index, 1);
      setPracticeExercises(updatedExercises);
    }
  };

  // Update practice exercises safely
  const updatePracticeExercise = (index: number, field: 'question' | 'answer' | 'explanation', value: string) => {
    if (!practiceExercises) {
      setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
      return;
    }
    
    const updatedExercises = [...practiceExercises];
    if (!updatedExercises[index]) {
      updatedExercises[index] = { question: "", answer: "", explanation: "" };
    }
    updatedExercises[index][field] = value;
    setPracticeExercises(updatedExercises);
    form.setValue('practiceExercises', updatedExercises);
  };

  const onSubmit = async (values: z.infer<typeof lessonFormSchema>) => {
    try {
      // 動態導入 supabase 函數
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      // 使用 as any 臨時解決類型問題
      const supabaseWithTypes = supabaseClient as any;
      
      // Convert topics string to array
      const topicsArray = values.topics.split(',').map(topic => topic.trim());
      
      // Basic lesson data that should work with any schema
      const basicLessonData = {
        title: values.title,
        description: values.description,
        duration: values.duration,
        level: values.level,
        // Topics might need to be stored as a string in some DB schemas
        topics: topicsArray,
      };

      // Create a JSON-friendly version of the data for storage
      const jsonExtras = {
        genially_link: values.geniallyLink || '',
        teaching_content: values.teachingContent,
        practice_exercises: practiceExercises
      };

      // Store extended data as JSON in 'metadata' field if it exists
      // or try each field individually
      let lessonData: any = {
        ...basicLessonData,
        // Try both approaches - if the columns exist, they'll be used
        // If not, the error handling below will catch it
        genially_link: values.geniallyLink || '',
        teaching_content: values.teachingContent,
        practice_exercises: safeStringify(practiceExercises),
        // Also try a metadata field that might exist
        metadata: safeStringify(jsonExtras)
      };

      if (editingLesson) {
        // First try updating with all fields
        let response = await supabaseWithTypes
          .from('lessons')
          .update(lessonData)
          .eq('id', editingLesson.id);

        // If there's an error that might be due to missing columns
        if (response.error && response.error.message.includes('column') && response.error.message.includes('does not exist')) {
          console.warn('Encountered schema mismatch, trying with basic fields only:', response.error);
          
          // Try again with just the basic fields
          response = await supabaseWithTypes
            .from('lessons')
            .update(basicLessonData)
            .eq('id', editingLesson.id);
            
          if (response.error) {
            console.error('Failed even with basic fields:', response.error);
            throw response.error;
          }
        } else if (response.error) {
          throw response.error;
        }
        
        // For client-side state, use the full data model
        const updatedLesson = {
          ...editingLesson,
          ...basicLessonData,
          genially_link: values.geniallyLink || '',
          teaching_content: values.teachingContent,
          practice_exercises: practiceExercises,
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
        
        // First try inserting with all fields
        let response = await supabaseWithTypes
          .from('lessons')
          .insert([fullData]);

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
            .insert([basicData]);
            
          if (response.error) {
            console.error('Failed even with basic fields:', response.error);
            throw response.error;
          }
        } else if (response.error) {
          throw response.error;
        }
        
        // For client-side representation, use the full data model
        const newLesson = {
          id: Math.random().toString(36).substring(2, 9),
          ...basicLessonData,
          genially_link: values.geniallyLink || '',
          teaching_content: values.teachingContent,
          practice_exercises: practiceExercises,
          created_at: new Date().toISOString()
        };
        
        // Add the new lesson to the state
        setLessons(prev => [...prev, newLesson as Lesson]);
        
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
    if (!confirm(t('delete_lesson_confirm'))) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 動態導入 supabase 函數
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      // 使用 as any 臨時解決類型問題
      const supabaseWithTypes = supabaseClient as any;
      
      // Delete the lesson from Supabase
      const { error } = await supabaseWithTypes
        .from('lessons')
        .delete()
        .eq('id', lessonId);
        
      if (error) {
        throw error;
      }
      
      // Remove the lesson from the local state
      setLessons(lessons.filter(lesson => lesson.id !== lessonId));
      
      toast({
        title: t('lesson_deleted'),
        description: t('lesson_delete_success'),
      });
    } catch (error: any) {
      toast({
        title: t('lesson_error_delete'),
        description: error.message || t('lesson_error_delete_msg'),
        variant: 'destructive',
      });
      console.error('Error deleting lesson:', error);
    } finally {
      setIsLoading(false);
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

  return (
    <div className="space-y-6">
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
                  form.reset();
                }}
              >
            <PlusCircle className="mr-2 h-4 w-4" />
            {t('create_lesson')}
          </Button>
            )}
          </div>
        }
      />
      
      {isLoading ? (
        <div className="flex justify-center items-center py-20 min-h-[60vh]">
          <p className="text-lg">{t('loading_lessons')}</p>
        </div>
      ) : (
        <div className="content-transition">
          {showEditForm ? (
            <div className="min-h-[60vh]">
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-xl font-semibold">{editingLesson ? t('edit_lesson') : t('create_lesson')}</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingLesson(null);
                    form.reset();
                    setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
                  }}
                >
                  {t('cancel')}
                </Button>
              </div>
              
              {editingLesson && (
                <div className="mb-6">
                  <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                      <CardTitle>{editingLesson.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{editingLesson.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Clock className="h-4 w-4" />
                        <span>{editingLesson.duration}{t('minutes')}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {Array.isArray(editingLesson.topics) ? editingLesson.topics.map((topic) => (
                          <Badge key={topic} variant="outline" className="bg-muted/50">
                            {topic}
                          </Badge>
                        )) : null}
                      </div>
                      <Badge variant="outline" className={getLevelColor(editingLesson.level)}>
                        {translateLevel(editingLesson.level)}
                      </Badge>
                      {editingLesson.genially_link && (
                        <div className="mt-3 text-sm text-blue-600">
                          <a href={editingLesson.genially_link} target="_blank" rel="noopener noreferrer" className="flex items-center hover:underline">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {t('view_presentation')}
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          <FormMessage />
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
                              defaultValue={field.value}
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
                    name="description"
                    render={({ field }: { field: any }) => (
                      <FormItem>
                        <FormLabel>{t('description')}</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={t('describe_lesson')}
                            {...field} 
                          />
                        </FormControl>
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
                          <FormMessage />
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
                          const exercise = await generatePracticeExercise(content, level);
                          setPracticeExercises([exercise]);
                          form.setValue("practiceExercises", [exercise]);
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
                      <Wand2 className="mr-2 h-4 w-4" />
                      {isGenerating ? (
                        <span className="inline-flex items-center">
                          {t('generating')}
                          <span className="ml-1 animate-[dots_1.5s_infinite]">.</span>
                          <span className="ml-0.5 animate-[dots_1.5s_infinite_0.2s]">.</span>
                          <span className="ml-0.5 animate-[dots_1.5s_infinite_0.4s]">.</span>
                        </span>
                      ) : (
                        t('generate_exercise')
                      )}
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name="practiceExercises"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>{t('practice_exercises')}</FormLabel>
                          {form.formState.errors.practiceExercises && (
                            <p className="text-sm font-medium text-destructive">
                              {t('exercise_required')}
                            </p>
                          )}
                        </div>
                        <FormControl>
                          <div className="p-4 border rounded-md bg-muted/20">
                            <div className="space-y-4">
                              <div>
                                <FormLabel className="text-sm">{t('question')}</FormLabel>
                                <Textarea 
                                  placeholder={t('enter_question')}
                                  value={practiceExercises[0]?.question || ""}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePracticeExercise(0, 'question', e.target.value)}
                                  className="resize-none"
                                />
                              </div>
                              <div>
                                <FormLabel className="text-sm">{t('answer')}</FormLabel>
                                <Textarea 
                                  placeholder={t('enter_answer')}
                                  value={practiceExercises[0]?.answer || ""}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePracticeExercise(0, 'answer', e.target.value)}
                                  className="resize-none"
                                />
                              </div>
                              <div>
                                <FormLabel className="text-sm">{t('explanation')}</FormLabel>
                                <Textarea 
                                  placeholder={t('enter_explanation')}
                                  value={practiceExercises[0]?.explanation || ""}
                                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updatePracticeExercise(0, 'explanation', e.target.value)}
                                  className="resize-none"
                                />
                              </div>
                            </div>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setShowEditForm(false);
                        setEditingLesson(null);
                        form.reset();
                        setPracticeExercises([{ question: "", answer: "", explanation: "" }]);
                      }}
                    >
                      {t('cancel')}
                    </Button>
                    <Button type="submit">
                      {editingLesson ? t('save_changes') : t('create_lesson')}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          ) : (
            <div>
              {/* Grid View */}
              {viewMode === 'grid' && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 min-h-[60vh]">
                  {lessons.map((lesson) => (
                    <Card key={lesson.id} className="flex flex-col h-full min-h-[15rem]">
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
                    onClick={() => deleteLesson(lesson.id)}
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
              {viewMode === 'list' && (
                <div className="space-y-4 min-h-[60vh]">
                  {lessons.map((lesson) => (
                    <Card key={lesson.id} className="min-h-[6rem]">
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center">
                              <h3 className="text-lg font-medium mr-2">{lesson.title}</h3>
                              <Badge variant="outline" className={getLevelColor(lesson.level)}>
                                {translateLevel(lesson.level)}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground line-clamp-2">
                              {lesson.description}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
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
                              onClick={() => deleteLesson(lesson.id)}
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
