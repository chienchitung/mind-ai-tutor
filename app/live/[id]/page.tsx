'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, ThumbsUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { participantStorageKey, QUESTION_LENSES, type LiveSessionPublicState, type LiveQuestion, type QuestionLens } from '@/lib/live-session';
import { REACTION_EMOJI, ReactionBurstOverlay, useReactionBursts } from '@/components/live/ReactionBurst';

const PULSE_FACES = ['😵', '😕', '🙂', '😄', '🤩'];
const REACTION_KINDS = ['applause', 'insight', 'resonate', 'pause'] as const;

function sortQuestions(a: LiveQuestion, b: LiveQuestion): number {
  return b.upvotes - a.upvotes || a.createdAt.localeCompare(b.createdAt);
}

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
  const [voteError, setVoteError] = useState('');

  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [qaText, setQaText] = useState('');
  const [qaLens, setQaLens] = useState<QuestionLens>('clarify');
  const [qaSending, setQaSending] = useState(false);
  const [qaError, setQaError] = useState('');
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [reacting, setReacting] = useState<string | null>(null);
  const { reactions, push: pushReaction } = useReactionBursts();
  const [onlineCount, setOnlineCount] = useState(0);

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

  const loadQuestions = useCallback(async () => {
    if (!participantId) return;
    try {
      const response = await fetch(`/api/live/${code}/questions?participantId=${participantId}`, { cache: 'no-store' });
      if (!response.ok) return;
      setQuestions(await response.json());
    } catch {
      // Best-effort - the panel just stays empty until the next successful load or broadcast.
    }
  }, [code, participantId]);

  useEffect(() => { void loadQuestions(); }, [loadQuestions]);

  useEffect(() => {
    // Waiting for participantId too (it resolves almost immediately after
    // mount) means the channel is created with a stable presence key from
    // the start, instead of tracking under a throwaway key and re-tracking.
    if (!data?.sessionId || !participantId) return;
    const client = supabase();
    const channel = client.channel(`live-session:${data.sessionId}`, { config: { presence: { key: participantId } } });
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
      .on('broadcast', { event: 'question:new' }, ({ payload }) => {
        const incoming = payload as LiveQuestion;
        setQuestions((previous) => (previous.some((item) => item.id === incoming.id) ? previous : [...previous, incoming].sort(sortQuestions)));
      })
      .on('broadcast', { event: 'question:upvote' }, ({ payload }) => {
        const { questionId, upvotes } = payload as { questionId: string; upvotes: number };
        setQuestions((previous) => previous.map((item) => (item.id === questionId ? { ...item, upvotes } : item)).sort(sortQuestions));
      })
      .on('broadcast', { event: 'question:moderated' }, () => {
        // Whether a question was just hidden or re-shown, refetching is the
        // simplest way to stay consistent with what this participant may or
        // may not be allowed to see - the broadcast alone doesn't carry enough.
        void loadQuestions();
      })
      .on('broadcast', { event: 'reaction:sent' }, ({ payload }) => {
        pushReaction((payload as { kind: string }).kind);
      })
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === 'SUBSCRIBED') void channel.track({ online_at: new Date().toISOString() });
      });
    // Belt-and-suspenders: see the presenter page for why - a light poll of
    // the already-local presenceState() as a fallback in case the 'sync'
    // event itself doesn't fire.
    const presenceInterval = setInterval(() => {
      setOnlineCount(Object.keys(channel.presenceState()).length);
    }, 4000);
    return () => { clearInterval(presenceInterval); void client.removeChannel(channel); };
  }, [data?.sessionId, participantId, loadQuestions, pushReaction]);

  const castVote = async (optionIndex: number) => {
    if (!data?.poll || !participantId || data.status !== 'open' || myVote === optionIndex) return;
    // Optimistic, like Slido/Mentimeter voting: the tap itself is the
    // feedback, the server tally reconciles a moment later in the background.
    const previousVote = myVote;
    setMyVote(optionIndex);
    setVoteError('');
    try {
      const response = await fetch(`/api/live/${code}/vote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, optionIndex }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setData((previous) => (previous?.poll ? { ...previous, poll: { ...previous.poll, ...result } } : previous));
    } catch {
      setMyVote(previousVote);
      setVoteError(t('live_vote_error'));
    }
  };

  const sendPulse = async (value: number) => {
    if (!participantId || data?.status !== 'open' || myPulse === value) return;
    const previousPulse = myPulse;
    setMyPulse(value);
    try {
      const response = await fetch(`/api/live/${code}/pulse`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, value }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setData((previous) => (previous ? { ...previous, pulse: result } : previous));
    } catch {
      setMyPulse(previousPulse);
    }
  };

  const submitQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!participantId || !qaText.trim() || qaSending || data?.status !== 'open') return;
    setQaSending(true);
    setQaError('');
    try {
      const response = await fetch(`/api/live/${code}/questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, text: qaText.trim(), lens: qaLens }),
      });
      if (!response.ok) throw new Error();
      const created = (await response.json()) as LiveQuestion;
      setQuestions((previous) => (previous.some((item) => item.id === created.id) ? previous : [...previous, { ...created, isMine: true }]).sort(sortQuestions));
      setQaText('');
    } catch {
      setQaError(t('live_qa_send_error'));
    } finally {
      setQaSending(false);
    }
  };

  const upvoteQuestion = async (id: string) => {
    if (!participantId || upvotedIds.has(id) || data?.status !== 'open') return;
    setUpvotedIds((previous) => new Set(previous).add(id));
    setQuestions((previous) => previous.map((item) => (item.id === id ? { ...item, upvotes: item.upvotes + 1 } : item)).sort(sortQuestions));
    try {
      const response = await fetch(`/api/live/${code}/questions/${id}/upvote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setQuestions((previous) => previous.map((item) => (item.id === id ? { ...item, upvotes: result.upvotes } : item)).sort(sortQuestions));
    } catch {
      setUpvotedIds((previous) => { const next = new Set(previous); next.delete(id); return next; });
      setQuestions((previous) => previous.map((item) => (item.id === id ? { ...item, upvotes: Math.max(0, item.upvotes - 1) } : item)).sort(sortQuestions));
    }
  };

  const sendReaction = async (kind: string) => {
    if (data?.status !== 'open' || reacting) return;
    setReacting(kind);
    try {
      await fetch(`/api/live/${code}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) });
    } catch {
      // Best-effort - a dropped reaction just doesn't show up on the projector.
    } finally {
      setTimeout(() => setReacting(null), 400);
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
      <ReactionBurstOverlay reactions={reactions} className="fixed inset-0 z-[60]" />
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.title}</p>
              {data.status !== 'open' && (
                <p className="mt-1 text-sm font-medium text-muted-foreground">{t(data.status === 'paused' ? 'live_status_paused' : 'live_status_closed')}</p>
              )}
            </div>
            {onlineCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                <Users className="h-3 w-3" />{t('live_online_count', { count: onlineCount })}
              </span>
            )}
          </div>

          {data.poll ? (
            <div className="space-y-3">
              <p className="font-semibold leading-relaxed">{data.poll.question}</p>
              <div className="space-y-2">
                {data.poll.options.map((option, index) => (
                  <button key={index} type="button" disabled={data.status !== 'open'}
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
                  <button key={value} type="button" disabled={data.status !== 'open'} onClick={() => void sendPulse(value)}
                    aria-label={`${t('live_pulse_prompt')} ${value}/5`}
                    className={`flex h-11 flex-1 items-center justify-center rounded-full border text-lg transition-colors disabled:opacity-50 ${myPulse === value ? 'border-primary bg-primary/10' : 'hover:border-foreground/30'}`}>
                    {face}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{t('live_reactions_title')}</p>
            <div className="flex justify-between gap-2">
              {REACTION_KINDS.map((kind) => (
                <button key={kind} type="button" disabled={data.status !== 'open'} onClick={() => void sendReaction(kind)}
                  aria-label={t(`live_reaction_${kind}` as const)}
                  className={`flex h-11 flex-1 items-center justify-center rounded-full border text-lg transition-transform disabled:opacity-50 ${reacting === kind ? 'scale-110 border-primary bg-primary/10' : 'hover:border-foreground/30'}`}>
                  {REACTION_EMOJI[kind]}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{t('live_qa_title')}</p>
            <form onSubmit={submitQuestion} className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {QUESTION_LENSES.map((lens) => (
                  <button key={lens} type="button" onClick={() => setQaLens(lens)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${qaLens === lens ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-foreground/30'}`}>
                    {t(`live_qa_lens_${lens}` as const)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea value={qaText} onChange={(event) => setQaText(event.target.value)} rows={1} maxLength={500}
                  placeholder={t('live_qa_ask_placeholder')} disabled={qaSending || data.status !== 'open'} className="min-h-0 resize-none py-2" />
                <Button type="submit" size="sm" disabled={qaSending || !qaText.trim() || data.status !== 'open'}>
                  {qaSending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('live_qa_submit')}
                </Button>
              </div>
              {qaError && <p role="alert" className="text-xs text-destructive">{qaError}</p>}
            </form>

            {questions.length === 0 ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">{t('live_qa_empty')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {questions.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-xs">
                    <div className="min-w-0">
                      <span className="mb-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{t(`live_qa_lens_${item.lens}` as const)}</span>
                      <p className="break-words">{item.text}</p>
                      {item.isMine && item.visibility === 'author_only' && (
                        <p className="mt-1 text-[10px] text-muted-foreground">{t('live_qa_mine_hidden')}</p>
                      )}
                    </div>
                    <button type="button" disabled={upvotedIds.has(item.id) || data.status !== 'open'} onClick={() => void upvoteQuestion(item.id)}
                      aria-label={t('live_qa_upvote')}
                      className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 font-mono disabled:opacity-70 ${upvotedIds.has(item.id) ? 'border-primary bg-primary/10 text-primary' : 'hover:border-foreground/30'}`}>
                      <ThumbsUp className="h-3 w-3" />{item.upvotes}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
