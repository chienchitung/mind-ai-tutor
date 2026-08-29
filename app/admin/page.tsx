'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { Loader2, Users, Calendar, BookOpen, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  created_at: string;
}

interface TableCount {
  label: string;
  count: number | null;
  icon: React.ReactNode;
}

export default function AdminPage() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [tableCounts, setTableCounts] = useState<TableCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAdminData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();

        const [profilesResult, studentsResult, eventsResult, lessonsResult, feedbackResult] =
          await Promise.all([
            supabaseClient
              .from('profiles')
              .select('id, user_id, full_name, role, created_at')
              .order('created_at', { ascending: false }),
            supabaseClient.from('students').select('*', { count: 'exact', head: true }),
            supabaseClient.from('events').select('*', { count: 'exact', head: true }),
            supabaseClient.from('lessons').select('*', { count: 'exact', head: true }),
            supabaseClient.from('feedback').select('*', { count: 'exact', head: true }),
          ]);

        if (profilesResult.error) throw profilesResult.error;

        setProfiles((profilesResult.data as ProfileRow[]) || []);
        setTableCounts([
          { label: t('admin_students_label'), count: studentsResult.count, icon: <Users className="h-4 w-4" /> },
          { label: t('admin_events_label'), count: eventsResult.count, icon: <Calendar className="h-4 w-4" /> },
          { label: t('admin_lessons_label'), count: lessonsResult.count, icon: <BookOpen className="h-4 w-4" /> },
          { label: t('admin_feedback_label'), count: feedbackResult.count, icon: <MessageSquare className="h-4 w-4" /> },
        ]);
      } catch (err) {
        console.error('Error loading admin data:', err);
        setError(err instanceof Error ? err.message : t('failed_load_admin_data'));
      } finally {
        setIsLoading(false);
      }
    };

    loadAdminData();
  }, [t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        heading={t('admin_page_title')}
        text={t('admin_page_desc')}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tableCounts.map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.count ?? '-'}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin_user_roles_title')}</CardTitle>
          <CardDescription>
            {t('admin_user_roles_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('admin_no_profiles')}
            </p>
          ) : (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between border-b py-2 last:border-0"
                >
                  <div>
                    <p className="font-medium">{profile.full_name || t('admin_name_not_set')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('admin_joined_at')}{' '}
                      {new Date(profile.created_at).toLocaleDateString(language === 'zh-TW' ? 'zh-TW' : 'en-US')}
                    </p>
                  </div>
                  <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                    {profile.role || t('admin_role_unset')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
