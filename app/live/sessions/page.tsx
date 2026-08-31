'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Loader2, Plus, ExternalLink, Square } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sessions, setSessions] = useState<LiveSessionSummary[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/live-sessions', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      setSessions(await response.json());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const closeSession = async (id: string) => {
    if (closingId) return;
    setClosingId(id);
    const previous = sessions;
    setSessions((current) => current.map((session) => (session.id === id ? { ...session, status: 'closed' } : session)));
    try {
      const response = await fetch(`/api/live-sessions/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'closed' }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setSessions(previous);
      toast({ title: t('error'), description: t('error_updating_session'), variant: 'destructive' });
    } finally {
      setClosingId(null);
    }
  };

  const stillOpenCount = sessions.filter((session) => session.status !== 'closed').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader heading={t('live_sessions_title')} text={t('live_sessions_desc')} />
        <Button asChild>
          <Link href="/live/new"><Plus className="mr-1.5 h-4 w-4" />{t('live_start_session')}</Link>
        </Button>
      </div>

      {stillOpenCount > 0 && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('live_sessions_open_warning', { count: stillOpenCount })}
        </div>
      )}

      {status === 'loading' ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : status === 'error' ? (
        <p role="alert" className="py-12 text-center text-sm text-muted-foreground">{t('live_sessions_error')}</p>
      ) : sessions.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t('live_sessions_empty')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{session.title}</p>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${session.status === 'open' ? 'bg-red-100 text-red-600' : session.status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                      {session.status === 'open' && <span className="h-1.5 w-1.5 rounded-full bg-red-600" />}
                      {t(`live_status_${session.status}` as const)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format(new Date(session.createdAt), 'yyyy/MM/dd HH:mm')} · <span className="font-mono">{session.joinCode}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {session.status !== 'closed' && (
                    <Button type="button" size="sm" variant="outline" disabled={closingId === session.id} onClick={() => void closeSession(session.id)}>
                      {closingId === session.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Square className="mr-1.5 h-3.5 w-3.5" />}
                      {t('live_action_closed')}
                    </Button>
                  )}
                  <Button type="button" size="sm" onClick={() => window.open(`/live/${session.id}/present`, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />{t('live_reopen_presenter')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LiveSessionsPage() {
  return <AppLayout><LiveSessionsList /></AppLayout>;
}
