'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, BarChart2, Clock, Calendar, Sparkles, MessageSquare } from 'lucide-react';
import { StudentSelector } from './components/StudentSelector';
import { TimeSpentChart } from './components/TimeSpentChart';
import { CompletionRateChart } from './components/CompletionRateChart';
import { LearningTimeline } from './components/LearningTimeline';
import { CategoryDistribution } from './components/CategoryDistribution';
import { ExportButton } from './components/ExportButton';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { AIAnalysisReport } from './components/AIAnalysisReport';
import { AIInteractionChart } from './components/AIInteractionChart';

// Define LearningRecord type based on the Supabase schema
interface LearningRecord {
  id: number;
  student_id: string;
  student_name: string;
  lesson_id: number;
  started_at?: string; 
  completed_at?: string | null;
  time_spent_seconds?: number;
  category?: string | null;
  // Add field names from the database view
  started_at_taipei?: string;
  completed_at_taipei?: string;
  // Other alternative field names
  start_time?: string;
  end_time?: string;
  duration?: number;
}

// Define aggregated stats type
interface LearningStats {
  totalRecords: number;
  totalTimeSpent: number;
  averageTimePerLesson: number;
  completedLessons: number;
  completionRate: number;
  categoryCounts: Record<string, number>;
  lastActive: string | null;
  totalQuestionCount: number;
  averageQuestionsPerLesson: number;
}

// Add new interface for lesson data
interface Lesson {
  id: string;
  title: string;
}

// Add new interface for question counts
interface QuestionCount {
  lesson_id: string;
  question_count: number;
}

export default function ReportsPage() {
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [learningRecords, setLearningRecords] = useState<LearningRecord[]>([]);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(false);
  // Add state for lessons
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [questionCounts, setQuestionCounts] = useState<QuestionCount[]>([]);
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  // Fetch students list
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        console.log('Fetching students from learning_records_view...');
        
        // 動態導入 supabase 函數
        const { supabase } = await import('../../lib/supabase');
        const supabaseClient = supabase();
        
        // Try to fetch from the view
        const { data, error } = await supabaseClient
          .from('learning_records_view')
          .select('student_id, student_name')
          .order('student_name');

        console.log('Supabase response:', { data, error });

        if (error) {
          console.error('Error fetching students:', error);
          return;
        }

        // Deduplicate students
        const uniqueStudents = Array.from(
          new Map((data || []).map(item => [item.student_id, { id: item.student_id, name: item.student_name }]))
            .values()
        ) as { id: string; name: string }[];
        
        console.log('Unique students found:', uniqueStudents);
        setStudents(uniqueStudents);

        // Auto-select first student if available
        if (uniqueStudents.length > 0 && !selectedStudent) {
          setSelectedStudent(uniqueStudents[0].id);
        }
      } catch (error) {
        console.error('Error in fetchStudents:', error);
      }
    };

    fetchStudents();
  }, []);

  // Add a new effect to fetch lessons data
  useEffect(() => {
    const fetchLessons = async () => {
      try {
        // 動態導入 supabase 函數
        const { supabase } = await import('../../lib/supabase');
        const supabaseClient = supabase();
        
        const { data, error } = await supabaseClient
          .from('lessons')
          .select('id, title');

        if (error) {
          console.error('Error fetching lessons:', error);
          return;
        }

        setLessons(data || []);
      } catch (error) {
        console.error('Error in fetchLessons:', error);
      }
    };

    fetchLessons();
  }, []);

  // Fetch learning records when student is selected
  useEffect(() => {
    if (!selectedStudent) return;

    const fetchLearningRecords = async () => {
      setLoading(true);
      try {
        // 動態導入 supabase 函數
        const { supabase } = await import('../../lib/supabase');
        const supabaseClient = supabase();
        
        // Fetch learning records
        const { data: recordsData, error: recordsError } = await supabaseClient
          .from('learning_records_view')
          .select('*')
          .eq('student_id', selectedStudent);

        if (recordsError) {
          console.error('Error fetching learning records:', recordsError);
          return;
        }

        // Fetch question counts
        const { data: questionData, error: questionError } = await supabaseClient
          .from('question_counts')
          .select('*')
          .eq('student_id', selectedStudent);

        if (questionError) {
          console.error('Error fetching question counts:', questionError);
          return;
        }

        // Process records
        const processedRecords = (recordsData || []).map(record => ({
          ...record,
          started_at: record.started_at_taipei || record.started_at || record.start_time,
          completed_at: record.completed_at_taipei || record.completed_at || record.end_time,
          time_spent_seconds: record.time_spent_seconds || record.duration || 0
        }));

        setLearningRecords(processedRecords);
        setQuestionCounts(questionData || []);
        calculateStats(processedRecords, questionData || []);
      } catch (error) {
        console.error('Error in fetchLearningRecords:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLearningRecords();
  }, [selectedStudent]);

  // Calculate statistics from learning records
  const calculateStats = (records: LearningRecord[], questionData: QuestionCount[]) => {
    if (!records || records.length === 0) {
      setLearningStats(null);
      return;
    }

    // Helper functions for consistent field access
    const getCompletionField = (record: LearningRecord) => 
      record.completed_at_taipei || record.completed_at || record.end_time;
    
    const calculateTimeSpent = (record: LearningRecord): number => {
      // If time_spent_seconds is available, use it
      if (record.time_spent_seconds) return record.time_spent_seconds;
      
      // If duration is available, use it
      if (record.duration) return record.duration;
      
      // Try to calculate from start and end times
      const startTime = record.started_at_taipei || record.started_at || record.start_time;
      const endTime = record.completed_at_taipei || record.completed_at || record.end_time;
      
      if (startTime && endTime) {
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();
        return (end - start) / 1000; // Convert milliseconds to seconds
      }
      
      return 0; // Default if no data available
    };

    const totalRecords = records.length;
    const totalTimeSpent = records.reduce((sum, record) => sum + calculateTimeSpent(record), 0);
    const completedLessons = records.filter(record => getCompletionField(record)).length;
    const completionRate = (completedLessons / totalRecords) * 100;
    
    // Category distribution
    const categoryCounts: Record<string, number> = {};
    records.forEach(record => {
      const category = record.category || 'Uncategorized';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Find most recent activity
    let lastActive = null;
    if (records.length > 0) {
      // Sort records by date to find the most recent
      const sortedRecords = [...records].sort((a, b) => {
        const dateA = a.started_at_taipei || a.started_at || a.start_time;
        const dateB = b.started_at_taipei || b.started_at || b.start_time;
        
        if (!dateA) return 1;  // Push records without dates to the end
        if (!dateB) return -1; // Keep records with dates at the beginning
        
        return new Date(dateB).getTime() - new Date(dateA).getTime(); // Descending order
      });
      
      const mostRecentRecord = sortedRecords[0];
      const dateField = mostRecentRecord.started_at_taipei || 
                        mostRecentRecord.started_at || 
                        mostRecentRecord.start_time;
      
      if (dateField) {
        // 使用as進行類型斷言
        lastActive = new Date(dateField).toISOString() as any;
      }
    }

    // Calculate question count metrics
    const totalQuestionCount = questionData.reduce((sum, record) => sum + record.question_count, 0);
    const averageQuestionsPerLesson = totalQuestionCount / records.length;

    setLearningStats({
      totalRecords,
      totalTimeSpent,
      averageTimePerLesson: totalTimeSpent / totalRecords,
      completedLessons,
      completionRate,
      categoryCounts,
      lastActive,
      totalQuestionCount,
      averageQuestionsPerLesson
    });
  };

  // Format time (seconds) to human readable format
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format date to human readable format
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      
      // Format: yyyy-mm-dd h:mmAM/h:mmPM (with proper capitalization)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      let hours = date.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM'; // Use uppercase AM/PM
      hours = hours % 12;
      hours = hours ? hours : 12; // convert 0 to 12
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}${ampm}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Get the student name for display and export
  const selectedStudentName = selectedStudent 
    ? students.find(s => s.id === selectedStudent)?.name || ''
    : '';

  // Add a function to get lesson title by ID
  const getLessonTitle = (lessonId: number | string) => {
    // Convert both IDs to strings for comparison
    const stringLessonId = String(lessonId);
    const lesson = lessons.find(l => String(l.id) === stringLessonId);
    return lesson ? lesson.title : lessonId;
  };

  // Extract unique course titles in the order they appear in records
  const getOrderedCourseTitles = () => {
    const uniqueLessonIds = learningRecords
      .filter((record, index, self) => 
        index === self.findIndex(r => r.lesson_id === record.lesson_id)
      )
      .map(record => record.lesson_id);
      
    return uniqueLessonIds.map(id => {
      const stringId = String(id);
      const lesson = lessons.find(l => String(l.id) === stringId);
      return lesson ? lesson.title : String(id);
    });
  };
  
  // Get ordered course titles once
  const orderedCourseTitles = getOrderedCourseTitles();

  if (loading && !learningRecords.length) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Prepare safe rendering of data with fallbacks
  const getStartTime = (record: LearningRecord) => 
    record.started_at_taipei || record.started_at || record.start_time;
  const getEndTime = (record: LearningRecord) => 
    record.completed_at_taipei || record.completed_at || record.end_time;
  const getDuration = (record: LearningRecord) => 
    record.time_spent_seconds || record.duration || 0;

  return (
    <div className="w-full space-y-6 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">{t('learning_reports')}</h1>
          <p className="text-muted-foreground">{t('analyze_learning_patterns')}</p>
        </div>
        <div className="flex gap-2">
          <StudentSelector
            students={students}
            selectedStudent={selectedStudent}
            onSelectStudent={setSelectedStudent}
          />
          <ExportButton 
            records={learningRecords}
            studentName={selectedStudentName}
            disabled={loading}
          />
        </div>
      </div>

      {learningRecords.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6 h-64">
            <BarChart2 className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-xl font-medium mb-2">{t('no_learning_data')}</h3>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              {selectedStudent 
                ? t('no_records_yet')
                : t('select_student_prompt')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{t('total_learning_time')}</p>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-bold">{formatTime(learningStats?.totalTimeSpent || 0)}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('avg_per_lesson', { time: formatTime(learningStats?.averageTimePerLesson || 0) })}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{t('completion_rate')}</p>
                  <BarChart2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-bold">
                    {learningStats?.completionRate.toFixed(1)}%
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('of_lessons', { total: learningStats?.totalRecords || 0 })}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{t('last_activity')}</p>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3">
                  <h3 className="text-lg font-bold">
                    {learningStats?.lastActive ? formatDate(learningStats.lastActive) : t('not_available')}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {learningRecords.length} {t('total_sessions')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{t('ai_interaction_count')}</p>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-bold">
                    {learningStats?.totalQuestionCount || 0}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('ai_interactions_per_lesson', { count: learningStats?.averageQuestionsPerLesson?.toFixed(1) || '0' })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data Visualization Tabs */}
          <Tabs defaultValue="time-spent" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="time-spent">{t('time_distribution')}</TabsTrigger>
              <TabsTrigger value="completion">{t('completion_rates')}</TabsTrigger>
              <TabsTrigger value="timeline">{t('learning_timeline')}</TabsTrigger>
              <TabsTrigger value="categories">{t('categories')}</TabsTrigger>
              <TabsTrigger value="ai-interactions">{t('ai_interaction_distribution')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="time-spent" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>{t('learning_time_distribution')}</CardTitle>
                  <CardDescription>
                    {t('time_spent_analysis')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <TimeSpentChart 
                    records={learningRecords} 
                    lessons={lessons} 
                    courseOrder={orderedCourseTitles} 
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="completion" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>{t('lesson_completion_analysis')}</CardTitle>
                  <CardDescription>
                    {t('completion_vs_progress')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <CompletionRateChart stats={learningStats} />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="timeline" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>{t('learning_activity_timeline')}</CardTitle>
                  <CardDescription>
                    {t('chronological_view')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <LearningTimeline 
                    records={learningRecords} 
                    lessons={lessons} 
                    courseOrder={orderedCourseTitles} 
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="categories" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>{t('category_distribution')}</CardTitle>
                  <CardDescription>
                    {t('lessons_by_category')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <CategoryDistribution stats={learningStats} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai-interactions" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>{t('ai_interaction_distribution')}</CardTitle>
                  <CardDescription>
                    {t('ai_interaction_by_lesson')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  <AIInteractionChart 
                    records={questionCounts}
                    lessons={lessons}
                    courseOrder={orderedCourseTitles}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Recent Records */}
          <Card>
            <CardHeader>
              <CardTitle>{t('recent_learning')}</CardTitle>
              <CardDescription>
                {t('latest_sessions', { count: Math.min(5, learningRecords.length) })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="p-2 text-sm font-medium text-muted-foreground">{t('lesson_title')}</th>
                      <th className="p-2 text-sm font-medium text-muted-foreground">{t('started')}</th>
                      <th className="p-2 text-sm font-medium text-muted-foreground">{t('completed')}</th>
                      <th className="p-2 text-sm font-medium text-muted-foreground">{t('time_spent')}</th>
                      <th className="p-2 text-sm font-medium text-muted-foreground">{t('category')}</th>
                      <th className="p-2 text-sm font-medium text-muted-foreground">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learningRecords.slice(0, 5).map((record) => (
                      <tr key={record.id} className="border-b last:border-b-0">
                        <td className="p-2 text-sm">{getLessonTitle(record.lesson_id)}</td>
                        <td className="p-2 text-sm">{formatDate(getStartTime(record))}</td>
                        <td className="p-2 text-sm">
                          {getEndTime(record) ? formatDate(getEndTime(record)) : '-'}
                        </td>
                        <td className="p-2 text-sm">{formatTime(getDuration(record))}</td>
                        <td className="p-2 text-sm">{record.category || t('uncategorized')}</td>
                        <td className="p-2 text-sm">
                          {getEndTime(record) ? (
                            <div className="flex items-center">
                              <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                              <span className="text-green-700 font-medium">
                                {t('completed')}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <div className="w-2 h-2 rounded-full bg-amber-500 mr-2"></div>
                              <span className="text-amber-700 font-medium">
                                {t('in_progress')}
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          
          {/* AI Analysis Report - Add this new section */}
          <AIAnalysisReport 
            learningRecords={learningRecords}
            learningStats={learningStats}
            selectedStudentName={selectedStudentName}
          />
        </>
      )}
    </div>
  );
} 