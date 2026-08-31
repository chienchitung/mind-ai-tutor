'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Loader2,
  Plus,
  ArrowUpRight,
  Search,
  Radio,
  CalendarDays,
  Trash2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DeleteConfirmation } from '@/components/ui/delete-confirmation';
import { Input } from '@/components/ui/input';
import {
  EndSessionButton,
  SessionStatus,
} from '@/components/live/LiveSessionUI';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import type { LiveSessionStatus } from '@/lib/live-session';

interface LiveSessionSummary {
  id: string;
  title: string;
  status: LiveSessionStatus;
  joinCode: string;
  createdAt: string;
}

function LiveSessionsList() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [sessions, setSessions] = useState<LiveSessionSummary[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [deleteTarget, setDeleteTarget] = useState<LiveSessionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await fetch('/api/live-sessions', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      setSessions(await response.json());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closeSession = async (id: string) => {
    if (closingId || deleting) return;
    setClosingId(id);
    const previous = sessions;
    setSessions((current) =>
      current.map((session) =>
        session.id === id ? { ...session, status: 'closed' } : session,
      ),
    );
    try {
      const response = await fetch(`/api/live-sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setSessions(previous);
      toast({
        title: t('error'),
        description: t('error_updating_session'),
        variant: 'destructive',
      });
    } finally {
      setClosingId(null);
    }
  };

  const deleteSession = async () => {
    if (!deleteTarget || deleting || closingId) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/live-sessions/${deleteTarget.id}`, { method: 'DELETE' });
      if (response.status === 409) throw new Error('SESSION_CHANGED');
      if (!response.ok && response.status !== 404) throw new Error('DELETE_FAILED');
      setSessions(current => current.filter(session => session.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({ title: t('live_session_deleted') });
    } catch (error) {
      toast({ title: t('error'), description: error instanceof Error && error.message === 'SESSION_CHANGED' ? t('live_delete_changed') : t('live_delete_failed'), variant: 'destructive' });
    } finally { setDeleting(false); }
  };

  const stillOpenCount = sessions.filter(
    (session) => session.status !== 'closed',
  ).length;

  const filtered = sessions.filter(
    (session) =>
      (filter === 'all' ||
        (filter === 'active'
          ? session.status !== 'closed'
          : session.status === 'closed')) &&
      `${session.title} ${session.joinCode}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );

  return (
    <div className="space-y-6">
      <DeleteConfirmation name={deleteTarget?.title ?? null} busy={deleting} description={t('live_delete_scope')} onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteSession()} />
      <PageHeader
        heading={t('live_sessions_title')}
        text={t('live_sessions_desc')}
        actions={
          <Button asChild className="min-h-11">
            <Link href="/live/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('live_start_session')}
            </Link>
          </Button>
        }
      />
      {status === 'loading' ? (
        <div
          role="status"
          className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('live_loading')}
        </div>
      ) : status === 'error' ? (
        <Card>
          <CardContent className="space-y-4 p-8 text-center md:pt-8">
            <p role="alert" className="text-sm text-muted-foreground">
              {t('live_sessions_error')}
            </p>
            <Button variant="outline" onClick={() => void load()}>
              {t('try_again')}
            </Button>
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center p-8 py-16 text-center md:pt-8">
            <Radio className="mb-5 h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              {t('live_sessions_empty')}
            </h2>
            <p className="mb-6 mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {t('live_empty_hint')}
            </p>
            <Button asChild className="min-h-11">
              <Link href="/live/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('live_start_session')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div
              role="group"
              aria-label={t('all_statuses')}
              className="flex flex-wrap gap-1 rounded-xl border bg-card p-1"
            >
              {(['all', 'active', 'closed'] as const).map((value) => (
                <Button
                  key={value}
                  variant={filter === value ? 'secondary' : 'ghost'}
                  className="min-h-11 gap-2 px-3 text-xs"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {t(`live_filter_${value}`)}
                  <span className="font-mono text-muted-foreground">
                    {value === 'all'
                      ? sessions.length
                      : value === 'active'
                        ? stillOpenCount
                        : sessions.length - stillOpenCount}
                  </span>
                </Button>
              ))}
            </div>
            <div className="relative xl:w-64">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={t('live_search')}
                placeholder={t('live_search')}
                className="h-11 bg-card pl-9"
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="app-panel space-y-4 p-8 text-center">
              <p role="status" className="text-sm text-muted-foreground">
                {t('live_no_matches')}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setFilter('all');
                  setQuery('');
                }}
              >
                {t('live_clear_filters')}
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((session) => (
                <li
                  key={session.id}
                  className="app-panel flex min-w-0 flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center"
                >
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted/50 sm:flex">
                      <Radio className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">
                          {session.title}
                        </h2>
                        <SessionStatus status={session.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {format(
                            new Date(session.createdAt),
                            'yyyy/MM/dd HH:mm',
                          )}
                        </span>
                        <span>
                          {t('live_join_code_label')}{' '}
                          <span className="font-mono tracking-wider text-foreground">
                            {session.joinCode}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3 lg:shrink-0 lg:border-0 lg:pt-0">
                    {session.status !== 'closed' && (
                      <EndSessionButton
                        disabled={closingId !== null || deleting}
                        onConfirm={() => void closeSession(session.id)}
                      />
                    )}
                    {session.status === 'closed' && <Button variant="ghost" className="min-h-11 text-destructive hover:text-destructive" disabled={closingId !== null || deleting} onClick={() => setDeleteTarget(session)}>
                      <Trash2 className="mr-2 h-4 w-4" />{t('delete')}
                    </Button>}
                    <Button asChild variant="outline" className="min-h-11">
                      <Link href={`/live/${session.id}/present`}>
                        {t('live_open_workspace')}
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default function LiveSessionsPage() {
  return (
    <AppLayout>
      <LiveSessionsList />
    </AppLayout>
  );
}
