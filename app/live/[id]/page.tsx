'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  ThumbsUp,
  Users,
  CheckCircle2,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  LiveHeader,
  LivePageState,
  SessionStatus,
} from '@/components/live/LiveSessionUI';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import {
  participantStorageKey,
  QUESTION_LENSES,
  type LiveSessionPublicState,
  type LiveQuestion,
  type QuestionLens,
} from '@/lib/live-session';
import {
  REACTION_EMOJI,
  ReactionBurstOverlay,
  useReactionBursts,
} from '@/components/live/ReactionBurst';
import { useOnlinePresenceCount } from '@/components/live/usePresenceHeartbeat';

const HEARTBEAT_INTERVAL_MS = 10000;

// Stored values run from 1 (too easy) to 5 (too hard).
const PULSE_FACES = ['😌', '🙂', '👌', '😕', '😵'];
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
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'not-found' | 'error'
  >('loading');
  const [data, setData] = useState<LiveSessionPublicState | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [myPulse, setMyPulse] = useState<number | null>(null);
  const [voteError, setVoteError] = useState('');

  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [qaText, setQaText] = useState('');
  const [qaLens, setQaLens] = useState<QuestionLens>('clarify');
  const [qaSending, setQaSending] = useState(false);
  const [qaError, setQaError] = useState('');
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [reactingKinds, setReactingKinds] = useState<Set<string>>(new Set());
  const [reactionError, setReactionError] = useState('');
  const reactionCooldowns = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(
    () => () => {
      reactionCooldowns.current.forEach(clearTimeout);
      reactionCooldowns.current.clear();
    },
    [],
  );
  const { reactions, push: pushReaction } = useReactionBursts();
  const { onlineCount, registerPing } = useOnlinePresenceCount();

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/live/${code}`, { cache: 'no-store' });
      if (response.status === 404) {
        setStatus('not-found');
        return;
      }
      if (!response.ok) {
        setStatus('error');
        return;
      }
      const json = await response.json();
      setData(json);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setParticipantId(getParticipantId(code));
  }, [code]);

  const loadQuestions = useCallback(async () => {
    if (!participantId) return;
    try {
      const response = await fetch(
        `/api/live/${code}/questions?participantId=${participantId}`,
        { cache: 'no-store' },
      );
      if (!response.ok) return;
      setQuestions(await response.json());
    } catch {
      // Best-effort - the panel just stays empty until the next successful load or broadcast.
    }
  }, [code, participantId]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    if (!data?.sessionId || !participantId) return;
    const client = supabase();
    const channel = client.channel(`live-session:${data.sessionId}`);
    channel
      .on('broadcast', { event: 'poll:opened' }, ({ payload }) => {
        setMyVote(null);
        setSelectedOption(null);
        setData((previous) =>
          previous
            ? { ...previous, poll: payload as LiveSessionPublicState['poll'] }
            : previous,
        );
      })
      .on('broadcast', { event: 'poll:tally' }, ({ payload }) => {
        setData((previous) => {
          if (
            !previous?.poll ||
            previous.poll.pollId !== (payload as { pollId: string }).pollId
          )
            return previous;
          return {
            ...previous,
            poll: {
              ...previous.poll,
              voteCounts: (payload as any).voteCounts,
              voteTotal: (payload as any).voteTotal,
            },
          };
        });
      })
      .on('broadcast', { event: 'pulse:update' }, ({ payload }) => {
        setData((previous) =>
          previous
            ? { ...previous, pulse: payload as LiveSessionPublicState['pulse'] }
            : previous,
        );
      })
      .on('broadcast', { event: 'session:status' }, ({ payload }) => {
        setData((previous) =>
          previous
            ? {
                ...previous,
                status: (
                  payload as { status: LiveSessionPublicState['status'] }
                ).status,
              }
            : previous,
        );
      })
      .on('broadcast', { event: 'question:new' }, ({ payload }) => {
        const incoming = payload as LiveQuestion;
        setQuestions((previous) =>
          previous.some((item) => item.id === incoming.id)
            ? previous
            : [...previous, incoming].sort(sortQuestions),
        );
      })
      .on('broadcast', { event: 'question:upvote' }, ({ payload }) => {
        const { questionId, upvotes } = payload as {
          questionId: string;
          upvotes: number;
        };
        setQuestions((previous) =>
          previous
            .map((item) =>
              item.id === questionId ? { ...item, upvotes } : item,
            )
            .sort(sortQuestions),
        );
      })
      .on('broadcast', { event: 'question:moderated' }, () => {
        // Whether a question was just hidden or re-shown, refetching is the
        // simplest way to stay consistent with what this participant may or
        // may not be allowed to see - the broadcast alone doesn't carry enough.
        void loadQuestions();
      })
      .on('broadcast', { event: 'session:deleted' }, () => { void load(); })
      .on('broadcast', { event: 'reaction:sent' }, ({ payload }) => {
        const reaction = payload as { kind: string; reactionId?: string };
        pushReaction(reaction.kind, reaction.reactionId);
      })
      .on('broadcast', { event: 'presence:ping' }, ({ payload }) => {
        registerPing((payload as { participantId: string }).participantId);
      })
      .subscribe((subscribeStatus) => {
        // Sending before the channel has actually joined would silently
        // drop the message - wait for confirmation, then the interval
        // below keeps it alive every HEARTBEAT_INTERVAL_MS after that.
        if (subscribeStatus === 'SUBSCRIBED')
          void channel.send({
            type: 'broadcast',
            event: 'presence:ping',
            payload: { participantId },
          });
      });
    const heartbeat = setInterval(() => {
      void channel.send({
        type: 'broadcast',
        event: 'presence:ping',
        payload: { participantId },
      });
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(heartbeat);
      void client.removeChannel(channel);
    };
  }, [
    data?.sessionId,
    participantId,
    loadQuestions,
    pushReaction,
    registerPing,
  ]);

  const selectOption = (optionIndex: number) => {
    if (!data?.poll || data.status !== 'open') return;
    setSelectedOption(optionIndex);
    setVoteError('');
  };

  const submitVote = async () => {
    if (
      selectedOption === null ||
      !data?.poll ||
      !participantId ||
      data.status !== 'open' ||
      voteSubmitting ||
      selectedOption === myVote
    )
      return;
    setVoteSubmitting(true);
    setVoteError('');
    try {
      const response = await fetch(`/api/live/${code}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, optionIndex: selectedOption }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setMyVote(selectedOption);
      setData((previous) =>
        previous?.poll
          ? { ...previous, poll: { ...previous.poll, ...result } }
          : previous,
      );
    } catch {
      setVoteError(t('live_vote_error'));
    } finally {
      setVoteSubmitting(false);
    }
  };

  const sendPulse = async (value: number) => {
    if (!participantId || data?.status !== 'open' || myPulse === value) return;
    const previousPulse = myPulse;
    setMyPulse(value);
    try {
      const response = await fetch(`/api/live/${code}/pulse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, value }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setData((previous) =>
        previous ? { ...previous, pulse: result } : previous,
      );
    } catch {
      setMyPulse(previousPulse);
    }
  };

  const submitQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !participantId ||
      !qaText.trim() ||
      qaSending ||
      data?.status !== 'open'
    )
      return;
    setQaSending(true);
    setQaError('');
    try {
      const response = await fetch(`/api/live/${code}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          text: qaText.trim(),
          lens: qaLens,
        }),
      });
      if (!response.ok) throw new Error();
      const created = (await response.json()) as LiveQuestion;
      setQuestions((previous) =>
        (previous.some((item) => item.id === created.id)
          ? previous
          : [...previous, { ...created, isMine: true }]
        ).sort(sortQuestions),
      );
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
    setQuestions((previous) =>
      previous
        .map((item) =>
          item.id === id ? { ...item, upvotes: item.upvotes + 1 } : item,
        )
        .sort(sortQuestions),
    );
    try {
      const response = await fetch(`/api/live/${code}/questions/${id}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setQuestions((previous) =>
        previous
          .map((item) =>
            item.id === id ? { ...item, upvotes: result.upvotes } : item,
          )
          .sort(sortQuestions),
      );
    } catch {
      setUpvotedIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      setQuestions((previous) =>
        previous
          .map((item) =>
            item.id === id
              ? { ...item, upvotes: Math.max(0, item.upvotes - 1) }
              : item,
          )
          .sort(sortQuestions),
      );
    }
  };

  const sendReaction = async (kind: string) => {
    // Only the tapped emoji cools down - the rest of the panel stays live so
    // mashing several different reactions back to back never feels blocked.
    if (data?.status !== 'open' || reactionCooldowns.current.has(kind)) return;
    const reactionId = crypto.randomUUID();
    pushReaction(kind, reactionId);
    setReactingKinds((previous) => new Set(previous).add(kind));
    setReactionError('');
    const cooldown = setTimeout(() => {
      reactionCooldowns.current.delete(kind);
      setReactingKinds((previous) => {
        const next = new Set(previous);
        next.delete(kind);
        return next;
      });
    }, 200);
    reactionCooldowns.current.set(kind, cooldown);
    try {
      const response = await fetch(`/api/live/${code}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, reactionId }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('REACTION_SEND_FAILED');
    } catch {
      setReactionError(t('live_reaction_send_failed'));
    }
  };

  if (status === 'loading') {
    return <LivePageState loading message={t('live_loading')} />;
  }
  if (status === 'not-found' || status === 'error') {
    return (
      <LivePageState
        message={t(
          status === 'not-found' ? 'live_code_not_found' : 'live_session_error',
        )}
      >
        {status === 'error' && (
          <Button variant="outline" onClick={() => void load()}>
            {t('try_again')}
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/live">{t('live_join_title')}</Link>
        </Button>
      </LivePageState>
    );
  }
  if (!data) return null;

  return (
    <div className="min-h-screen bg-background">
      <LiveHeader />
      <ReactionBurstOverlay
        reactions={reactions}
        className="fixed inset-0 z-[60]"
      />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="app-kicker mb-2">Live Session</p>
            <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">
              {data.title}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <SessionStatus status={data.status} />
            {onlineCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {t('live_online_count', { count: onlineCount })}
              </span>
            )}
          </div>
        </div>
        {data.status !== 'open' && (
          <p
            role="status"
            className="rounded-xl border bg-muted/60 px-4 py-3 text-sm leading-6 text-muted-foreground"
          >
            {t(
              data.status === 'paused'
                ? 'live_audience_paused'
                : 'live_audience_closed',
            )}
          </p>
        )}
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-5">
            <Card>
              <CardContent className="p-5 sm:p-6 md:pt-6">
                <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  {t('live_current_poll')}
                </h2>
                {data.poll ? (
                  <div className="space-y-4">
                    <p className="break-words text-xl font-semibold leading-relaxed tracking-tight">
                      {data.poll.question}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {t('live_vote_hint')}
                    </p>
                    <div className="space-y-3">
                      {data.poll.options.map((option, index) => (
                        <button
                          key={index}
                          type="button"
                          disabled={data.status !== 'open'}
                          aria-pressed={selectedOption === index}
                          onClick={() => selectOption(index)}
                          className={`flex min-h-14 w-full items-center gap-3 rounded-xl border p-4 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${selectedOption === index ? 'border-primary bg-primary/5' : 'bg-card hover:border-foreground/40 hover:bg-muted/40'}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs ${selectedOption === index ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/40'}`}
                          >
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="min-w-0 flex-1 break-words">
                            {option}
                          </span>
                          {selectedOption === index && (
                            <CheckCircle2
                              aria-hidden="true"
                              className="h-4 w-4 shrink-0 text-primary"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      className="min-h-11"
                      onClick={() => void submitVote()}
                      disabled={
                        selectedOption === null ||
                        selectedOption === myVote ||
                        voteSubmitting ||
                        data.status !== 'open'
                      }
                    >
                      {voteSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t('live_vote_submit')
                      )}
                    </Button>
                    {myVote !== null && myVote === selectedOption && (
                      <p
                        role="status"
                        className="flex items-center gap-2 text-xs font-medium text-primary"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t('live_vote_sent')}
                      </p>
                    )}
                    {voteError && (
                      <p role="alert" className="text-xs text-destructive">
                        {voteError}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="py-8 text-sm text-muted-foreground">
                    {t('live_no_active_poll')}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 sm:p-6 md:pt-6">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  {t('live_qa_title')}
                </h2>
                <form onSubmit={submitQuestion} className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {QUESTION_LENSES.map((lens) => (
                      <button
                        key={lens}
                        type="button"
                        aria-pressed={qaLens === lens}
                        onClick={() => setQaLens(lens)}
                        className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${qaLens === lens ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-foreground/30'}`}
                      >
                        {t(`live_qa_lens_${lens}` as const)}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Textarea
                      aria-label={t('live_qa_ask_placeholder')}
                      value={qaText}
                      onChange={(event) => setQaText(event.target.value)}
                      rows={1}
                      maxLength={500}
                      placeholder={t('live_qa_ask_placeholder')}
                      disabled={qaSending || data.status !== 'open'}
                      className="min-h-20 resize-y py-3"
                    />
                    <Button
                      type="submit"
                      className="min-h-11"
                      disabled={
                        qaSending || !qaText.trim() || data.status !== 'open'
                      }
                    >
                      {qaSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t('live_qa_submit')
                      )}
                    </Button>
                  </div>
                  {qaError && (
                    <p role="alert" className="text-xs text-destructive">
                      {qaError}
                    </p>
                  )}
                </form>

                {questions.length === 0 ? (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    {t('live_qa_empty')}
                  </p>
                ) : (
                  <ul className="mt-4 max-h-96 space-y-3 overflow-y-auto">
                    {questions.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="mb-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {t(`live_qa_lens_${item.lens}` as const)}
                          </span>
                          <p className="break-words">{item.text}</p>
                          {item.isMine && item.visibility === 'author_only' && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {t('live_qa_mine_hidden')}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={
                            upvotedIds.has(item.id) || data.status !== 'open'
                          }
                          onClick={() => void upvoteQuestion(item.id)}
                          aria-label={t('live_qa_upvote')}
                          aria-pressed={upvotedIds.has(item.id)}
                          className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg border px-2 py-1 font-mono disabled:opacity-70 ${upvotedIds.has(item.id) ? 'border-primary bg-primary/10 text-primary' : 'hover:border-foreground/30'}`}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          {item.upvotes}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          <aside
            className="min-w-0 space-y-5"
            aria-label={t('live_participation')}
          >
            <Card>
              <CardContent className="p-5 sm:p-6 md:pt-6">
                <h2 className="mb-4 text-sm font-semibold">
                  {t('live_pulse_prompt')}
                </h2>
                <div className="flex gap-1.5">
                  {PULSE_FACES.map((face, index) => {
                    const value = (index + 1) as 1 | 2 | 3 | 4 | 5;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={data.status !== 'open'}
                        onClick={() => void sendPulse(value)}
                        aria-label={t(`live_pulse_level_${value}`)}
                        title={t(`live_pulse_level_${value}`)}
                        aria-pressed={myPulse === value}
                        className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl border text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${myPulse === value ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                      >
                        {face}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                  <span>{t('live_pulse_easy')}</span>
                  <span>{t('live_pulse_ok')}</span>
                  <span>{t('live_pulse_hard')}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 sm:p-6 md:pt-6">
                <h2 className="mb-4 text-sm font-semibold">
                  {t('live_reactions_title')}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {REACTION_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      disabled={data.status !== 'open' || reactingKinds.has(kind)}
                      onClick={() => void sendReaction(kind)}
                      className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border px-2 py-3 text-xs transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 active:scale-95 ${reactingKinds.has(kind) ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                    >
                      <span aria-hidden="true" className="text-xl">
                        {REACTION_EMOJI[kind]}
                      </span>
                      {t(`live_reaction_${kind}`)}
                    </button>
                  ))}
                </div>
                {reactionError && <p role="alert" className="mt-3 text-xs text-destructive">{reactionError}</p>}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
