'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { Loader2, Users, Calendar, BookOpen, MessageSquare } from 'lucide-react';

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
          { label: '學生', count: studentsResult.count, icon: <Users className="h-4 w-4" /> },
          { label: '行事曆事件', count: eventsResult.count, icon: <Calendar className="h-4 w-4" /> },
          { label: '課程', count: lessonsResult.count, icon: <BookOpen className="h-4 w-4" /> },
          { label: '回饋', count: feedbackResult.count, icon: <MessageSquare className="h-4 w-4" /> },
        ]);
      } catch (err) {
        console.error('Error loading admin data:', err);
        setError(err instanceof Error ? err.message : '無法載入系統資訊');
      } finally {
        setIsLoading(false);
      }
    };

    loadAdminData();
  }, []);

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
        heading="系統管理"
        text="僅 admin 角色可見的後台系統資訊"
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
          <CardTitle>使用者角色</CardTitle>
          <CardDescription>
            所有已在 profiles 表建立紀錄的使用者與其角色
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              目前沒有使用者在 profiles 表建立紀錄。
            </p>
          ) : (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between border-b py-2 last:border-0"
                >
                  <div>
                    <p className="font-medium">{profile.full_name || '(未設定名稱)'}</p>
                    <p className="text-xs text-muted-foreground">
                      加入時間:{' '}
                      {new Date(profile.created_at).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                  <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                    {profile.role || 'unset'}
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
