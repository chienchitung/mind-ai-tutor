'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { participantStorageKey, type LiveSessionPublicState } from '@/lib/live-session';

const PULSE_FACES = ['😵', '😕', '🙂', '😄', '🤩'];

function getParticipantId(sessionId: string): string {
  const key = participantStorageKey(sessionId);
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export default function AudiencePage() {
  const params = useParams<{ id: string }>();
  const code = params.id;
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [data, setData] = useState<LiveSessionPublicState | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [myPulse, setMyPulse] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [voteError, setVoteError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/live/${code}`, { cache: 'no-store' });
      if (response.status === 404) { setStatus('not-found'); return; }
      if (!response.ok) { setStatus('error'); return; }
      const json = await response.json();
      setData(json);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [code]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setParticipantId(getParticipantId(code)); }, [code]);

  useEffect(() => {
    if (!data?.sessionId) return;
    const client = supabase();
    const channel = client.channel(`live-session:${data.sessionId}`);
    channel
      .on('broadcast', { event: 'poll:opened' }, ({ payload }) => {
        setMyVote(null);
        setData((previous) => (previous ? { ...previous, poll: payload as LiveSessionPublicState['poll'] } : previous));
      })
      .on('broadcast', { event: 'poll:tally' }, ({ payload }) => {
        setData((previous) => {
          if (!previous?.poll || previous.poll.pollId !== (payload as { pollId: string }).pollId) return previous;
          return { ...previous, poll: { ...previous.poll, voteCounts: (payload as any).voteCounts, voteTotal: (payload as any).voteTotal } };
        });
      })
      .on('broadcast', { event: 'pulse:update' }, ({ payload }) => {
        setData((previous) => (previous ? { ...previous, pulse: payload as LiveSessionPublicState['pulse'] } : previous));
      })
      .on('broadcast', { event: 'session:status' }, ({ payload }) => {
        setData((previous) => (previous ? { ...previous, status: (payload as { status: LiveSessionPublicState['status'] }).status } : previous));
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [data?.sessionId]);

  const castVote = async (optionIndex: number) => {
    if (!data?.poll || voting || !participantId || data.status !== 'open') return;
    setVoting(true);
    setVoteError('');
    try {
      const response = await fetch(`/api/live/${code}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, optionIndex }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setMyVote(optionIndex);
      setData((previous) => (previous?.poll ? { ...previous, poll: { ...previous.poll, ...result } } : previous));
    } catch {
      setVoteError(t('live_vote_error'));
    } finally {
      setVoting(false);
    }
  };

  const sendPulse = async (value: number) => {
    if (pulsing || !participantId || data?.status !== 'open') return;
    setPulsing(true);
    try {
      const response = await fetch(`/api/live/${code}/pulse`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, value }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setMyPulse(value);
      setData((previous) => (previous ? { ...previous, pulse: result } : previous));
    } catch {
      // Best-effort; the pulse is a lightweight signal, not worth a blocking error state.
    } finally {
      setPulsing(false);
    }
  };

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (status === 'not-found' || status === 'error') {
    return <div className="flex min-h-screen items-center justify-center p-4">
      <p role="alert" className="max-w-sm text-center text-muted-foreground">{t(status === 'not-found' ? 'live_code_not_found' : 'live_session_error')}</p>
    </div>;
  }
  if (!data) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="space-y-5 p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.title}</p>
            {data.status !== 'open' && (
              <p className="mt-1 text-sm font-medium text-muted-foreground">{t(data.status === 'paused' ? 'live_status_paused' : 'live_status_closed')}</p>
            )}
          </div>

          {data.poll ? (
            <div className="space-y-3">
              <p className="font-semibold leading-relaxed">{data.poll.question}</p>
              <div className="space-y-2">
                {data.poll.options.map((option, index) => (
                  <button key={index} type="button" disabled={voting || data.status !== 'open'}
                    onClick={() => void castVote(index)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors disabled:opacity-60 ${myVote === index ? 'border-primary bg-primary/10' : 'hover:border-foreground/30'}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs ${myVote === index ? 'border-primary bg-primary text-primary-foreground' : ''}`}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </button>
                ))}
              </div>
              {myVote !== null && <p className="text-xs font-medium text-primary">✓ {t('live_vote_sent')}</p>}
              {voteError && <p role="alert" className="text-xs text-destructive">{voteError}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('live_no_active_poll')}</p>
          )}

          <div className="border-t pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{t('live_pulse_prompt')}</p>
            <div className="flex justify-between gap-2">
              {PULSE_FACES.map((face, index) => {
                const value = index + 1;
                return (
                  <button key={value} type="button" disabled={pulsing || data.status !== 'open'} onClick={() => void sendPulse(value)}
                    aria-label={`${t('live_pulse_prompt')} ${value}/5`}
                    className={`flex h-11 flex-1 items-center justify-center rounded-full border text-lg transition-colors disabled:opacity-50 ${myPulse === value ? 'border-primary bg-primary/10' : 'hover:border-foreground/30'}`}>
                    {face}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
