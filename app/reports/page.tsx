'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, BarChart2, Clock, Calendar, Sparkles } from 'lucide-react';
// 移除直接導入
// import { supabase } from '../../lib/supabase';
// Temporarily remove Gemini to simplify setup
// import { generateLearningAnalysis } from '../../lib/gemini';
import { StudentSelector } from './components/StudentSelector';
import { TimeSpentChart } from './components/TimeSpentChart';
import { CompletionRateChart } from './components/CompletionRateChart';
import { LearningTimeline } from './components/LearningTimeline';
import { CategoryDistribution } from './components/CategoryDistribution';
import { ExportButton } from './components/ExportButton';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

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
}

export default function ReportsPage() {
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [learningRecords, setLearningRecords] = useState<LearningRecord[]>([]);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(false);
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

  // Fetch learning records when student is selected
  useEffect(() => {
    if (!selectedStudent) return;

    const fetchLearningRecords = async () => {
      setLoading(true);
      try {
        // 動態導入 supabase 函數
        const { supabase } = await import('../../lib/supabase');
        const supabaseClient = supabase();
        
        // Try to fetch from the view
        const { data, error } = await supabaseClient
          .from('learning_records_view')
          .select('*')
          .eq('student_id', selectedStudent);

        if (error) {
          console.error('Error fetching learning records:', error);
          return;
        }

        console.log('Records data:', data);

        // Process records to handle possible field name differences
        const processedRecords = (data || []).map(record => ({
          ...record,
          // Ensure consistent field names for our application, prioritizing taipei fields
          started_at: record.started_at_taipei || record.started_at || record.start_time,
          completed_at: record.completed_at_taipei || record.completed_at || record.end_time,
          time_spent_seconds: record.time_spent_seconds || record.duration || 0
        }));

        setLearningRecords(processedRecords);
        calculateStats(processedRecords);
      } catch (error) {
        console.error('Error in fetchLearningRecords:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLearningRecords();
  }, [selectedStudent]);

  // Calculate statistics from learning records
  const calculateStats = (records: LearningRecord[]) => {
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

    setLearningStats({
      totalRecords,
      totalTimeSpent,
      averageTimePerLesson: totalTimeSpent / totalRecords,
      completedLessons,
      completionRate,
      categoryCounts,
      lastActive
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
                  <p className="text-sm text-muted-foreground">{t('primary_category')}</p>
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-3">
                  {learningStats?.categoryCounts && Object.keys(learningStats.categoryCounts).length > 0 ? (
                    <>
                      <h3 className="text-lg font-bold">
                        {Object.entries(learningStats.categoryCounts)
                          .sort(([, a], [, b]) => b - a)[0][0]}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Object.keys(learningStats.categoryCounts).length} {t('categories_total')}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-bold">{t('uncategorized')}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{t('no_categories')}</p>
                    </>
                  )}
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
                  <TimeSpentChart records={learningRecords} />
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
                  <LearningTimeline records={learningRecords} />
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
                      <th className="p-2 text-sm font-medium text-muted-foreground">{t('lesson_id')}</th>
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
                        <td className="p-2 text-sm">{record.lesson_id}</td>
                        <td className="p-2 text-sm">{formatDate(getStartTime(record))}</td>
                        <td className="p-2 text-sm">
                          {getEndTime(record) ? formatDate(getEndTime(record)) : '-'}
                        </td>
                        <td className="p-2 text-sm">{formatTime(getDuration(record))}</td>
                        <td className="p-2 text-sm">{record.category || t('uncategorized')}</td>
                        <td className="p-2 text-sm">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                            getEndTime(record)
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {getEndTime(record) ? t('completed') : t('in_progress')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
} 