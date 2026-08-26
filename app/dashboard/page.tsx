'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  ArrowUpRight,
  Users,
  BookOpen,
  GraduationCap,
  BarChart2,
  Calendar
} from 'lucide-react';
import { useEvents, EventProvider, Event } from '@/contexts/EventContext';
import { format, compareDesc } from 'date-fns';
import { TourGuide } from '@/components/TourGuide';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

// Define Stats type
type Stats = {
  activeStudents: number;
  completedLessons: number;
  activeCourses: number;
  completionRate: string; // Percentage representation
};

// Define Activity type
interface Activity {
  id: string;
  title: string;
  timestamp: string;
  source: 'lessons' | 'events' | 'feedback';
}

function DashboardContent() {
  const [loading, setLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [stats, setStats] = useState<Stats>({
    activeStudents: 0,
    completedLessons: 0,
    activeCourses: 0,
    completionRate: '0%',
  });
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const { events } = useEvents();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  // Sort events by date (newest first)
  const sortedEvents = [...events].sort((a, b) => 
    compareDesc(new Date(a.startDate), new Date(b.startDate))
  ).slice(0, 3); // Only get the first 3 for display

  // Format timestamp to relative time
  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return t('just_now');
    if (diffInHours < 24) return t('hours_ago', { n: diffInHours });
    if (diffInHours < 48) return t('yesterday');
    return t('days_ago', { n: Math.floor(diffInHours / 24) });
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { supabase } = await import('../../lib/supabase');
        const supabaseClient = supabase();

        const [studentsResult, lessonsResult, assignmentsResult] = await Promise.all([
          supabaseClient
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active'),
          supabaseClient
            .from('lessons')
            .select('*', { count: 'exact', head: true }),
          supabaseClient
            .from('assignments')
            .select('status'),
        ]);

        const activeStudents = studentsResult.count ?? 0;
        const activeCourses = lessonsResult.count ?? 0;
        const assignments = assignmentsResult.data ?? [];
        const completedLessons = assignments.filter((a: any) => a.status === 'completed').length;
        const completionRate = assignments.length > 0
          ? `${Math.round((completedLessons / assignments.length) * 100)}%`
          : '0%';

        setStats({
          activeStudents,
          completedLessons,
          activeCourses,
          completionRate,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Fetch recent activities from Supabase
  useEffect(() => {
    const fetchRecentActivities = async () => {
      setActivitiesLoading(true);
      try {
        let allActivities: Activity[] = [];
        
        // 動態導入 supabase 函數以避免服務器端渲染問題
        const { supabase } = await import('../../lib/supabase');
        const supabaseClient = supabase();
        
        // 1. Fetch recent lessons data
        try {
          const { data: lessonsData, error: lessonsError } = await supabaseClient
            .from('lessons')
            .select('id, title, updated_at')
            .order('updated_at', { ascending: false })
            .limit(5);
            
          if (lessonsError) {
            console.error('Error fetching lessons:', lessonsError);
          } else if (lessonsData) {
            // Map lessons to activities
            const lessonActivities = lessonsData.map((lesson: any) => ({
              id: `lesson-${lesson.id}`,
              title: `Course updated: ${lesson.title}`,
              timestamp: lesson.updated_at,
              source: 'lessons' as const
            }));
            allActivities = [...allActivities, ...lessonActivities];
          }
        } catch (err) {
          console.error('Error in lessons fetch:', err);
        }
        
        // 2. Fetch events data
        try {
          const { data: eventsData, error: eventsError } = await supabaseClient
            .from('events')
            .select('id, title, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
            
          if (eventsError) {
            console.error('Error fetching events:', eventsError);
          } else if (eventsData) {
            // Map events to activities
            const eventActivities = eventsData.map((event: any) => ({
              id: `event-${event.id}`,
              title: `New event: ${event.title}`,
              timestamp: event.created_at,
              source: 'events' as const
            }));
            allActivities = [...allActivities, ...eventActivities];
          }
        } catch (err) {
          console.error('Error in events fetch:', err);
        }
        
        // 3. Fetch feedback data
        try {
          const { data: feedbackData, error: feedbackError } = await supabaseClient
            .from('feedback')
            .select('id, student_name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
            
          if (feedbackError) {
            console.error('Error fetching feedback:', feedbackError);
          } else if (feedbackData) {
            // Map feedback to activities
            const feedbackActivities = feedbackData.map((feedback: any) => ({
              id: `feedback-${feedback.id}`,
              title: `${feedback.student_name} submitted feedback`,
              timestamp: feedback.created_at,
              source: 'feedback' as const
            }));
            allActivities = [...allActivities, ...feedbackActivities];
          }
        } catch (err) {
          console.error('Error in feedback fetch:', err);
        }
        
        // Sort all activities by timestamp (newest first)
        allActivities.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        // Take only the 4 most recent activities
        setRecentActivities(allActivities.slice(0, 4));
      } catch (error) {
        console.error('Error fetching recent activities:', error);
        setRecentActivities([]);
      } finally {
        setActivitiesLoading(false);
      }
    };

    fetchRecentActivities();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Helper function to get appropriate icon based on event type
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'course':
        return <GraduationCap className="h-5 w-5 text-blue-500" />;
      case 'workshop':
        return <BookOpen className="h-5 w-5 text-purple-500" />;
      case 'training':
        return <BarChart2 className="h-5 w-5 text-green-500" />;
      default:
        return <Calendar className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="w-full space-y-6 pb-8">
      {/* Welcome banner */}
      <div className="bg-primary/10 rounded-lg p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold mb-2">{t('welcome_title')}</h2>
        <p className="text-muted-foreground mb-4">
          {t('welcome_description')}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="default" className="bg-[#0f172a]" asChild>
            <a href="/lessons">
              {t('get_started')}
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button variant="outline" onClick={() => setShowTour(true)}>
            {t('take_tour')}
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4" data-tour="stats">
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4 md:p-6">
            <p className="text-sm text-muted-foreground">{t('active_students')}</p>
            <div className="mt-1">
              <h3 className="text-2xl md:text-3xl font-bold">{stats.activeStudents}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4 md:p-6">
            <p className="text-sm text-muted-foreground">{t('completed_lessons')}</p>
            <div className="mt-1">
              <h3 className="text-2xl md:text-3xl font-bold">{stats.completedLessons}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4 md:p-6">
            <p className="text-sm text-muted-foreground">{t('active_courses')}</p>
            <div className="mt-1">
              <h3 className="text-2xl md:text-3xl font-bold">{stats.activeCourses}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border border-gray-200">
          <CardContent className="p-4 md:p-6">
            <p className="text-sm text-muted-foreground">{t('avg_completion_rate')}</p>
            <div className="mt-1">
              <h3 className="text-2xl md:text-3xl font-bold">{stats.completionRate}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top actions cards with buttons at bottom */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="h-full hover:shadow-md transition-shadow" data-tour="student-management">
          <CardContent className="p-4 md:p-6 flex flex-col h-full">
            <div className="mb-4">
              <div className="p-2 bg-gray-100 w-fit rounded-lg">
                <Users className="h-5 w-5 text-gray-500" />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-1">{t('student_management')}</h3>
            <p className="text-sm text-muted-foreground">{t('student_management_desc')}</p>
            <div className="mt-auto pt-4">
              <Button variant="outline" className="w-full justify-between" asChild>
                <a href="/students">
                  {t('view')} <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full hover:shadow-md transition-shadow" data-tour="lessons">
          <CardContent className="p-4 md:p-6 flex flex-col h-full">
            <div className="mb-4">
              <div className="p-2 bg-gray-100 w-fit rounded-lg">
                <BookOpen className="h-5 w-5 text-gray-500" />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-1">{t('lessons_title')}</h3>
            <p className="text-sm text-muted-foreground">{t('lessons_desc')}</p>
            <div className="mt-auto pt-4">
              <Button variant="outline" className="w-full justify-between" asChild>
                <a href="/lessons">
                  {t('view')} <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full hover:shadow-md transition-shadow" data-tour="digital-games">
          <CardContent className="p-4 md:p-6 flex flex-col h-full">
            <div className="mb-4">
              <div className="p-2 bg-gray-100 w-fit rounded-lg">
                <GraduationCap className="h-5 w-5 text-gray-500" />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-1">{t('digital_games_title')}</h3>
            <p className="text-sm text-muted-foreground">{t('digital_games_desc')}</p>
            <div className="mt-auto pt-4">
              <Button variant="outline" className="w-full justify-between" asChild>
                <a href="/digital-games">
                  {t('view')} <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full hover:shadow-md transition-shadow" data-tour="analytics">
          <CardContent className="p-4 md:p-6 flex flex-col h-full">
            <div className="mb-4">
              <div className="p-2 bg-gray-100 w-fit rounded-lg">
                <BarChart2 className="h-5 w-5 text-gray-500" />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-1">{t('learning_analytics')}</h3>
            <p className="text-sm text-muted-foreground">{t('learning_analytics_desc')}</p>
            <div className="mt-auto pt-4">
              <Button variant="outline" className="w-full justify-between" asChild>
                <a href="/reports">
                  {t('view')} <ArrowUpRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom area: upcoming events and recent activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 md:p-6 pb-2">
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('upcoming_events')}
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-sm gap-1" asChild>
              <a href="/events">
                {t('view_all')} <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
          </CardHeader>
          <CardDescription className="px-4 md:px-6">
            {t('upcoming_events_desc')}
          </CardDescription>
          <CardContent className="p-4 md:p-6 pt-4">
            <div className="space-y-3">
              {sortedEvents.length > 0 ? (
                sortedEvents.map((event) => (
                  <div key={event.id} className="flex items-center p-3 bg-muted/30 rounded-md">
                    <div className="bg-gray-100 p-2 rounded-lg mr-3">
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(event.startDate), "yyyy/MM/dd")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  {t('no_upcoming_events')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent activities - UPDATED WITH REAL-TIME DATA */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 md:p-6 pb-2">
            <CardTitle className="text-lg md:text-xl">{t('recent_activity')}</CardTitle>
            <Button variant="ghost" size="sm" className="text-sm gap-1" asChild>
              <a href="/activities">
                {t('view_all')} <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
          </CardHeader>
          <CardDescription className="px-4 md:px-6">
            {t('recent_activity_desc')}
          </CardDescription>
          <CardContent className="p-4 md:p-6 pt-4">
            {activitiesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-0">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="py-4 border-b border-gray-200 last:border-0">
                    <p className="font-medium">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTimeAgo(activity.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TourGuide isOpen={showTour} onClose={() => setShowTour(false)} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <EventProvider>
      <DashboardContent />
    </EventProvider>
  );
} 