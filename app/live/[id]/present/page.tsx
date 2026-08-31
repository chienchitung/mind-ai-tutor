'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Play, Pause, Square, Plus, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import type { LiveSessionOwnerState, LiveSessionStatus } from '@/lib/live-session';

const PULSE_LABELS = ['😵', '😕', '🙂', '😄', '🤩'];

export default function PresenterPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [data, setData] = useState<LiveSessionOwnerState | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isOpeningPoll, setIsOpeningPoll] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<LiveSessionStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/live-sessions/${params.id}`, { cache: 'no-store' });
      if (response.status === 401) { router.push('/login'); return; }
      if (response.status === 404) { setStatus('not-found'); return; }
      if (!response.ok) { setStatus('error'); return; }
      setData(await response.json());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [params.id, router]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!params.id) return;
    const client = supabase();
    const channel = client.channel(`live-session:${params.id}`);
    channel
      .on('broadcast', { event: 'poll:opened' }, ({ payload }) => {
        setData((previous) => (previous ? { ...previous, poll: payload as LiveSessionOwnerState['poll'] } : previous));
      })
      .on('broadcast', { event: 'poll:tally' }, ({ payload }) => {
        setData((previous) => {
          if (!previous?.poll || previous.poll.pollId !== (payload as { pollId: string }).pollId) return previous;
          return { ...previous, poll: { ...previous.poll, voteCounts: (payload as any).voteCounts, voteTotal: (payload as any).voteTotal } };
        });
      })
      .on('broadcast', { event: 'pulse:update' }, ({ payload }) => {
        setData((previous) => (previous ? { ...previous, pulse: payload as LiveSessionOwnerState['pulse'] } : previous));
      })
      .on('broadcast', { event: 'session:status' }, ({ payload }) => {
        setData((previous) => (previous ? { ...previous, status: (payload as { status: LiveSessionStatus }).status } : previous));
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [params.id]);

  const handleOpenPoll = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2 || isOpeningPoll) return;
    setIsOpeningPoll(true);
    try {
      const response = await fetch(`/api/live-sessions/${params.id}/polls`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), options: cleanOptions }),
      });
      if (!response.ok) throw new Error();
      const poll = await response.json();
      setData((previous) => (previous ? { ...previous, poll } : previous));
      setShowComposer(false);
      setQuestion('');
      setOptions(['', '']);
    } catch {
      toast({ title: t('error'), description: t('error_opening_poll'), variant: 'destructive' });
    } finally {
      setIsOpeningPoll(false);
    }
  };

  const handleStatusChange = async (next: LiveSessionStatus) => {
    if (pendingStatus) return;
    setPendingStatus(next);
    try {
      const response = await fetch(`/api/live-sessions/${params.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error();
      setData((previous) => (previous ? { ...previous, status: next } : previous));
    } catch {
      toast({ title: t('error'), description: t('error_updating_session'), variant: 'destructive' });
    } finally {
      setPendingStatus(null);
    }
  };

  const copyJoinLink = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/live/${data.joinCode}`);
      toast({ title: t('link_copied') });
    } catch {
      toast({ title: t('error'), description: t('error_updating_session'), variant: 'destructive' });
    }
  };

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (status === 'not-found' || status === 'error') {
    return <div className="flex min-h-screen items-center justify-center p-4">
      <p role="alert" className="text-center text-muted-foreground">{t(status === 'not-found' ? 'live_session_not_found' : 'live_session_error')}</p>
    </div>;
  }
  if (!data) return null;

  const pulseAvg = data.pulse.pulseAverage;
  const pulsePercent = pulseAvg === null ? 50 : ((pulseAvg - 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('live_presenter_view')}</p>
            <h1 className="text-xl font-semibold">{data.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${data.status === 'open' ? 'bg-red-100 text-red-600' : data.status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
              {data.status === 'open' && <span className="h-1.5 w-1.5 rounded-full bg-red-600" />}
              {t(`live_status_${data.status}` as const)}
            </span>
            <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
              <span className="font-mono text-sm tracking-widest">{data.joinCode}</span>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={() => void copyJoinLink()}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={data.status === 'open' ? 'default' : 'outline'} disabled={!!pendingStatus} onClick={() => void handleStatusChange('open')}>
            <Play className="mr-1.5 h-3.5 w-3.5" />{t('live_status_open')}
          </Button>
          <Button type="button" size="sm" variant={data.status === 'paused' ? 'default' : 'outline'} disabled={!!pendingStatus} onClick={() => void handleStatusChange('paused')}>
            <Pause className="mr-1.5 h-3.5 w-3.5" />{t('live_status_paused')}
          </Button>
          <Button type="button" size="sm" variant={data.status === 'closed' ? 'default' : 'outline'} disabled={!!pendingStatus} onClick={() => void handleStatusChange('closed')}>
            <Square className="mr-1.5 h-3.5 w-3.5" />{t('live_status_closed')}
          </Button>
          <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setShowComposer((previous) => !previous)}>
            {showComposer ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            {t('live_new_poll')}
          </Button>
        </div>

        {showComposer && (
          <Card>
            <CardContent className="p-4">
              <form onSubmit={handleOpenPoll} className="space-y-3">
                <div>
                  <Label htmlFor="poll-question">{t('live_poll_question_label')}</Label>
                  <Textarea id="poll-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} maxLength={500} required />
                </div>
                <div className="space-y-2">
                  <Label>{t('live_poll_options_label')}</Label>
                  {options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input value={option} maxLength={120}
                        onChange={(event) => setOptions((previous) => previous.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                        placeholder={`${t('live_poll_option_placeholder')} ${String.fromCharCode(65 + index)}`} />
                      {options.length > 2 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => setOptions((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {options.length < 6 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setOptions((previous) => [...previous, ''])}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />{t('live_add_option')}
                    </Button>
                  )}
                </div>
                <Button type="submit" disabled={isOpeningPoll}>
                  {isOpeningPoll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('live_open_poll')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardContent className="p-6">
              {data.poll ? (
                <>
                  <p className="mb-4 text-lg font-semibold">{data.poll.question}</p>
                  <div className="space-y-2">
                    {data.poll.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border font-mono text-xs">{String.fromCharCode(65 + index)}</span>
                        {option}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t('live_no_active_poll')}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>{t('live_results')}</span>
                <span className="font-mono">{data.poll?.voteTotal ?? 0} {t('live_answered')}</span>
              </div>
              {data.poll?.options.map((option, index) => {
                const count = data.poll?.voteCounts[index] ?? 0;
                const total = data.poll?.voteTotal ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={index} className="grid grid-cols-[16px_1fr_34px] items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">{String.fromCharCode(65 + index)}</span>
                    <div className="h-2.5 overflow-hidden rounded-full border bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                    <span className="text-right font-mono text-muted-foreground">{pct}%</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{t('live_pulse_title')}</span>
              <span className="font-mono text-xs text-muted-foreground">{pulseAvg === null ? '—' : pulseAvg.toFixed(1)} / 5 · {data.pulse.pulseTotal} {t('live_answered')}</span>
            </div>
            <div className="relative h-2.5 rounded-full border" style={{ background: 'linear-gradient(90deg, #2f8f5b, transparent 50%, #c97f1d)' }}>
              {pulseAvg !== null && <div className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded bg-foreground" style={{ left: `${pulsePercent}%` }} />}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{t('live_pulse_easy')}</span><span>{t('live_pulse_ok')}</span><span>{t('live_pulse_hard')}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
