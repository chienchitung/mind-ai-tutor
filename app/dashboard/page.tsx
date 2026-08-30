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
  Gamepad2,
  BarChart2,
  Calendar
} from 'lucide-react';
import { useEvents, EventProvider, Event } from '@/contexts/EventContext';
import { format, compareDesc } from 'date-fns';
import { TourGuide } from '@/components/TourGuide';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoader } from '@/components/ui/page-state';
import Link from 'next/link';

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
              title: t('course_updated_text', { title: lesson.title }),
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
              title: t('new_event_text', { title: event.title }),
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
              title: t('new_feedback_from', { name: feedback.student_name }),
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
    return <PageLoader />;
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
    <div className="w-full space-y-7 pb-8">
      <PageHeader
        heading={t('welcome_title')}
        text={t('welcome_description')}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowTour(true)}>
              {t('take_tour')}
            </Button>
            <Button asChild>
            <Link href="/lessons">
              {t('get_started')}
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
            </Button>
          </>
        }
      />

      {/* Stats cards */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="app-kicker">{language === 'zh-TW' ? '教學概況' : 'Teaching overview'}</p>
          <span className="text-xs text-muted-foreground">{language === 'zh-TW' ? '即時資料' : 'Live data'}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="stats">
        <Card className="shadow-none">
          <CardContent className="p-4 md:p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{t('active_students')}</p>
              <span className="rounded-lg bg-muted p-2"><Users className="h-4 w-4" /></span>
            </div>
            <h3 className="text-3xl font-semibold tracking-tight">{stats.activeStudents}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{language === 'zh-TW' ? '目前啟用的學生' : 'Currently active learners'}</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-4 md:p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{t('completed_lessons')}</p>
              <span className="rounded-lg bg-muted p-2"><GraduationCap className="h-4 w-4" /></span>
            </div>
            <h3 className="text-3xl font-semibold tracking-tight">{stats.completedLessons}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{language === 'zh-TW' ? '已完成的指派' : 'Completed assignments'}</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-4 md:p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{t('active_courses')}</p>
              <span className="rounded-lg bg-muted p-2"><BookOpen className="h-4 w-4" /></span>
            </div>
            <h3 className="text-3xl font-semibold tracking-tight">{stats.activeCourses}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{language === 'zh-TW' ? '可使用的課程內容' : 'Available lesson content'}</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardContent className="p-4 md:p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{t('avg_completion_rate')}</p>
              <span className="rounded-lg bg-muted p-2"><BarChart2 className="h-4 w-4" /></span>
            </div>
            <h3 className="text-3xl font-semibold tracking-tight">{stats.completionRate}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{language === 'zh-TW' ? '所有指派的完成比例' : 'Across all assignments'}</p>
          </CardContent>
        </Card>
      </div>
      </section>

      <div className="flex items-end justify-between">
        <div>
          <p className="app-kicker">{language === 'zh-TW' ? '快速操作' : 'Quick actions'}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{language === 'zh-TW' ? '繼續今天的工作' : 'Continue your work'}</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="group h-full shadow-none transition-colors hover:border-foreground/30" data-tour="student-management">
          <CardContent className="p-4 md:p-6 flex flex-col h-full">
            <div className="mb-4">
              <div className="w-fit rounded-xl bg-foreground p-2 text-background">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-1">{t('student_management')}</h3>
            <p className="text-sm text-muted-foreground">{t('student_management_desc')}</p>
            <div className="mt-auto pt-4">
              <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent" asChild>
                <Link href="/students">
                  {t('view')} <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="group h-full shadow-none transition-colors hover:border-foreground/30" data-tour="lessons">
          <CardContent className="p-4 md:p-6 flex flex-col h-full">
            <div className="mb-4">
              <div className="w-fit rounded-xl bg-foreground p-2 text-background">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-1">{t('lessons_title')}</h3>
            <p className="text-sm text-muted-foreground">{t('lessons_desc')}</p>
            <div className="mt-auto pt-4">
              <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent" asChild>
                <Link href="/lessons">
                  {t('view')} <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="group h-full shadow-none transition-colors hover:border-foreground/30" data-tour="digital-games">
          <CardContent className="p-4 md:p-6 flex flex-col h-full">
            <div className="mb-4">
              <div className="w-fit rounded-xl bg-foreground p-2 text-background">
                <Gamepad2 className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-1">{t('digital_games_title')}</h3>
            <p className="text-sm text-muted-foreground">{t('digital_games_desc')}</p>
            <div className="mt-auto pt-4">
              <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent" asChild>
                <Link href="/digital-games">
                  {t('view')} <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="group h-full shadow-none transition-colors hover:border-foreground/30" data-tour="analytics">
          <CardContent className="p-4 md:p-6 flex flex-col h-full">
            <div className="mb-4">
              <div className="w-fit rounded-xl bg-foreground p-2 text-background">
                <BarChart2 className="h-5 w-5" />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-1">{t('learning_analytics')}</h3>
            <p className="text-sm text-muted-foreground">{t('learning_analytics_desc')}</p>
            <div className="mt-auto pt-4">
              <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent" asChild>
                <Link href="/reports">
                  {t('view')} <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom area: upcoming events and recent activities */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Upcoming events */}
        <Card className="shadow-none lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between p-4 md:p-6 pb-2">
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('upcoming_events')}
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-sm gap-1" asChild>
              <Link href="/events">
                {t('view_all')} <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardDescription className="px-4 md:px-6">
            {t('upcoming_events_desc')}
          </CardDescription>
          <CardContent className="p-4 md:p-6 pt-4">
            <div className="space-y-3">
              {sortedEvents.length > 0 ? (
                sortedEvents.map((event) => (
                  <div key={event.id} className="flex items-center rounded-xl border border-transparent bg-muted/45 p-3 transition-colors hover:border-border">
                    <div className="mr-3 rounded-lg bg-card p-2">
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
        <Card className="shadow-none lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between p-4 md:p-6 pb-2">
            <CardTitle className="text-lg md:text-xl">{t('recent_activity')}</CardTitle>
            <Button variant="ghost" size="sm" className="text-sm gap-1" asChild>
              <Link href="/activities">
                {t('view_all')} <ArrowUpRight className="h-4 w-4" />
              </Link>
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
                  <div key={activity.id} className="flex items-center gap-3 border-b border-border/70 py-4 last:border-0">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                    </div>
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
