'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { Users, Calendar, BookOpen, MessageSquare, Search, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { Input } from '@/components/ui/input';
import { ErrorState, PageLoader } from '@/components/ui/page-state';

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
  const [search, setSearch] = useState('');

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
    return <PageLoader />;
  }

  if (error) {
    return (
      <ErrorState
        title={t('failed_load_admin_data')}
        description={error}
        retryLabel={t('try_again')}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProfiles = profiles.filter((profile) =>
    !normalizedSearch
    || profile.full_name?.toLowerCase().includes(normalizedSearch)
    || profile.role?.toLowerCase().includes(normalizedSearch)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        heading={t('admin_page_title')}
        text={t('admin_page_desc')}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tableCounts.map((item) => (
          <Card key={item.label} className="shadow-none">
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

      <Card className="overflow-hidden shadow-none">
        <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              {t('admin_user_roles_title')}
            </CardTitle>
            <CardDescription className="mt-1.5">
              {t('admin_user_roles_desc')}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={language === 'zh-TW' ? '搜尋姓名或角色' : 'Search name or role'}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-0">
          {filteredProfiles.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">
              {t('admin_no_profiles')}
            </p>
          ) : (
            <div>
              <div className="hidden grid-cols-[minmax(0,1fr)_160px_140px] gap-4 bg-muted/35 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                <span>{language === 'zh-TW' ? '成員' : 'Member'}</span>
                <span>{language === 'zh-TW' ? '加入日期' : 'Joined'}</span>
                <span>{language === 'zh-TW' ? '角色' : 'Role'}</span>
              </div>
              {filteredProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="grid gap-3 border-t border-border/70 px-6 py-4 first:border-t-0 md:grid-cols-[minmax(0,1fr)_160px_140px] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{profile.full_name || t('admin_name_not_set')}</p>
                    <p className="truncate text-xs text-muted-foreground">{profile.user_id}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(profile.created_at).toLocaleDateString(language === 'zh-TW' ? 'zh-TW' : 'en-US')}
                  </p>
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
