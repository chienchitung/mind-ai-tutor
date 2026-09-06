'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { Users, Calendar, BookOpen, MessageSquare, Search, ShieldCheck, RefreshCw, Bot } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { Input } from '@/components/ui/input';
import { ErrorState, PageLoader } from '@/components/ui/page-state';
import { loadAdminOverview, type AdminOverview } from '@/lib/admin-overview';
import { useToast } from '@/hooks/use-toast';

const countCards = [
  { table: 'students', label: 'admin_students_label', icon: Users },
  { table: 'events', label: 'admin_events_label', icon: Calendar },
  { table: 'lessons', label: 'admin_lessons_label', icon: BookOpen },
  { table: 'feedback', label: 'admin_feedback_label', icon: MessageSquare },
] as const;

export default function AdminPage() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const chinese = language === 'zh-TW';
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const reload = () => setReloadVersion(value => value + 1);
  const { toast } = useToast();
  const [chatLimit, setChatLimit] = useState('');
  const [chatLimitLoading, setChatLimitLoading] = useState(true);
  const [chatLimitSaving, setChatLimitSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase().rpc('get_game_chat_daily_limit');
        if (active && !error && typeof data === 'number') setChatLimit(String(data));
      } finally {
        if (active) setChatLimitLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const saveChatLimit = async () => {
    const parsed = Number(chatLimit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      toast({ variant: 'destructive', title: chinese ? '請輸入大於 0 的整數' : 'Enter an integer greater than 0' });
      return;
    }
    setChatLimitSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase().rpc('set_game_chat_daily_limit', { p_limit: parsed });
      if (error) throw error;
      toast({ title: chinese ? '已更新每日詢問次數上限' : 'Daily question limit updated' });
    } catch {
      toast({ variant: 'destructive', title: chinese ? '更新失敗，請稍後再試' : 'Update failed, please try again' });
    } finally {
      setChatLimitSaving(false);
    }
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setOverview(null);
    const timeout = window.setTimeout(() => {
      controller.abort();
      if (active) { setError('ADMIN_TIMEOUT'); setIsLoading(false); }
    }, 15000);

    const load = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        if (!active) return;
        const result = await loadAdminOverview(supabase(), controller.signal);
        if (active) { setOverview(result); setError(null); }
      } catch {
        if (active) setError(controller.signal.aborted ? 'ADMIN_TIMEOUT' : 'ADMIN_LOAD_FAILED');
      } finally {
        window.clearTimeout(timeout);
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
    // Data is language-independent. Typing, rendering or translating must not refetch it.
  }, [reloadVersion]);

  const errorDescription = (code: string) => code === 'ADMIN_TIMEOUT'
    ? (chinese ? '載入逾時，請確認網路連線後重試。' : 'Loading timed out. Check your connection and retry.')
    : code === '42501'
      ? (chinese ? '目前無法讀取資料，請確認帳號與資料表的讀取權限。' : 'Unable to read this data. Check account and table permissions.')
      : (chinese ? '這部分資料載入失敗，請稍後重試；不代表沒有資料。' : 'This data could not be loaded. Retry shortly; this does not mean there are no records.');

  const profiles = overview?.profiles || [];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredProfiles = profiles.filter(profile => !normalizedSearch
    || profile.full_name?.toLowerCase().includes(normalizedSearch)
    || profile.role?.toLowerCase().includes(normalizedSearch));

  return (
    <div className="space-y-6">
      <PageHeader heading={t('admin_page_title')}
        text={chinese ? '管理員專用：查看可存取資料的概況與使用者角色。' : 'Administrator overview of accessible records and user roles.'}
        actions={<Button variant="outline" disabled={isLoading} onClick={reload}>
          <RefreshCw className={'mr-2 h-4 w-4' + (isLoading ? ' animate-spin' : '')} />
          {chinese ? '重新整理資料' : 'Refresh data'}
        </Button>}
      />
      <div className="app-panel space-y-2 p-4 text-sm">
        <Badge variant="secondary">{chinese ? '唯讀管理總覽' : 'Read-only overview'}</Badge>
        <p>{chinese ? '這裡可查看使用者角色與各類資料筆數，並調整下方的 AI 助教用量設定。目前不提供修改角色或停用帳號。' : 'Review user roles and record counts, and adjust the AI tutor usage setting below. Role changes and account suspension are not available here.'}</p>
        <p className="text-xs leading-5 text-muted-foreground">{chinese ? '統計依目前帳號與資料表權限計算，不一定是全站總數。使用者清單只包含已建立個人資料、且目前帳號可讀取的紀錄。' : 'Counts reflect your account’s database permissions, not necessarily site-wide totals. The user list includes only accessible profile records.'}</p>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />{chinese ? 'AI 助教用量設定' : 'AI tutor usage setting'}</CardTitle>
          <CardDescription>{chinese ? '控制數位遊戲中 Ellis AI 助教，每個裝置每天可以詢問的次數上限。登入管理員帳號測試時不受此上限影響。' : 'Controls how many questions a single device can ask Ellis, the AI tutor in the digital games, per day. Testing while logged in as an admin is never limited by this cap.'}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="game-chat-daily-limit" className="text-sm font-medium">{chinese ? '每個裝置每日詢問次數上限' : 'Daily questions per device'}</label>
            <Input id="game-chat-daily-limit" type="number" min={1} className="w-40" value={chatLimit}
              disabled={chatLimitLoading} onChange={event => setChatLimit(event.target.value)} />
          </div>
          <Button onClick={saveChatLimit} disabled={chatLimitLoading || chatLimitSaving}>
            {chatLimitSaving ? (chinese ? '儲存中…' : 'Saving…') : (chinese ? '儲存' : 'Save')}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? <><p role="status" className="text-sm text-muted-foreground">{chinese ? '正在載入管理資料…' : 'Loading administration data…'}</p><PageLoader /></>
        : error ? <ErrorState title={t('failed_load_admin_data')} description={errorDescription(error)} retryLabel={t('try_again')} onRetry={reload} />
        : overview && <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {countCards.map(({ table, label, icon: Icon }) => {
              const item = overview.counts[table];
              return <Card key={table} className="shadow-none">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t(label)}</CardTitle><Icon className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{item.error ? '—' : item.count}</div>
                  {item.error && <p role="alert" className="mt-2 text-xs text-destructive">{errorDescription(item.error)}</p>}
                </CardContent>
              </Card>;
            })}
          </div>
          <Card className="overflow-hidden shadow-none">
            <CardHeader className="gap-4 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{t('admin_user_roles_title')}</CardTitle>
                <CardDescription className="mt-1.5">{chinese ? '查看已載入的使用者與角色（僅供檢視）' : 'Loaded users and roles (view only)'}</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={event => setSearch(event.target.value)} disabled={Boolean(overview.profilesError)}
                  aria-label={chinese ? '搜尋已載入的姓名或角色' : 'Search loaded names or roles'}
                  placeholder={chinese ? '搜尋已載入的姓名或角色' : 'Search loaded names or roles'} className="pl-9" />
              </div>
            </CardHeader>
            <CardContent className="p-0 md:p-0">
              {overview.profilesError ? <ErrorState title={t('failed_load_admin_data')} description={errorDescription(overview.profilesError) + ' (' + overview.profilesError + ')'} retryLabel={t('try_again')} onRetry={reload} />
                : filteredProfiles.length === 0 ? <div className="space-y-3 px-6 py-12 text-center text-sm text-muted-foreground">
                  <p>{normalizedSearch ? (chinese ? '找不到符合搜尋條件的使用者。' : 'No users match your search.') : t('admin_no_profiles')}</p>
                  {normalizedSearch && <Button variant="outline" onClick={() => setSearch('')}>{chinese ? '清除搜尋' : 'Clear search'}</Button>}
                </div> : <>
                  <p className="px-6 py-3 text-xs text-muted-foreground">{chinese ? '顯示 ' : 'Showing '}{filteredProfiles.length} / {profiles.length}{chinese ? ' 筆已載入紀錄' : ' loaded records'}</p>
                  <div className="hidden grid-cols-[minmax(0,1fr)_160px_140px] gap-4 bg-muted/35 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                    <span>{chinese ? '成員' : 'Member'}</span><span>{chinese ? '加入日期' : 'Joined'}</span><span>{chinese ? '角色' : 'Role'}</span>
                  </div>
                  {filteredProfiles.map(profile => <div key={profile.id} className="grid gap-3 border-t border-border/70 px-6 py-4 md:grid-cols-[minmax(0,1fr)_160px_140px] md:items-center md:gap-4">
                    <div className="min-w-0">
                      <p className="font-medium">{profile.full_name || t('admin_name_not_set')}</p>
                      <p className="truncate text-xs text-muted-foreground">{profile.user_id}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{Number.isNaN(Date.parse(profile.created_at)) ? '—' : new Date(profile.created_at).toLocaleDateString(chinese ? 'zh-TW' : 'en-US')}</p>
                    <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'} className="w-fit">{profile.role || t('admin_role_unset')}</Badge>
                  </div>)}
                </>}
            </CardContent>
          </Card>
        </>}
    </div>
  );
}
