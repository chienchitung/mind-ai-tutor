'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  Play,
  Pause,
  Plus,
  Copy,
  X,
  FileUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  EyeOff,
  Eye,
  ListChecks,
  Maximize,
  Minimize,
  Users,
  BarChart3,
  MessageSquare,
  Presentation,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import type {
  LiveSessionOwnerState,
  LiveSessionStatus,
  LiveQuestion,
} from '@/lib/live-session';
import { uploadLiveDeck } from '@/lib/live-deck-storage';
import { DeckViewer } from '@/components/live/DeckViewer';
import {
  REACTION_EMOJI,
  ReactionBurstOverlay,
  useReactionBursts,
} from '@/components/live/ReactionBurst';
import { useOnlinePresenceCount } from '@/components/live/usePresenceHeartbeat';
import {
  EndSessionButton,
  LiveHeader,
  LivePageState,
  SessionStatus,
} from '@/components/live/LiveSessionUI';
import type { Quiz, QuizQuestion } from '@/lib/quiz';

const REACTION_KINDS = ['applause', 'insight', 'resonate', 'pause'] as const;

function sortQuestions(a: LiveQuestion, b: LiveQuestion): number {
  return b.upvotes - a.upvotes || a.createdAt.localeCompare(b.createdAt);
}

export default function PresenterPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'not-found' | 'error'
  >('loading');
  const [data, setData] = useState<LiveSessionOwnerState | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const statusChangePending = useRef(false);
  const [showComposer, setShowComposer] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isOpeningPoll, setIsOpeningPoll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDeck, setUploadingDeck] = useState(false);
  const [numDeckPages, setNumDeckPages] = useState(1);
  const [deckLoadError, setDeckLoadError] = useState(false);

  const [questions, setQuestions] = useState<LiveQuestion[]>([]);
  const [moderatingId, setModeratingId] = useState<string | null>(null);

  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(
    {},
  );
  const { reactions, push: pushReaction } = useReactionBursts();
  const { onlineCount, registerPing } = useOnlinePresenceCount();

  const [showQuizPicker, setShowQuizPicker] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [quizPickerError, setQuizPickerError] = useState('');

  const [presenting, setPresenting] = useState(false);
  const presentRef = useRef<HTMLDivElement>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Video-player style: the status/page-nav bars fade out after a few
  // seconds of no mouse movement over the projected deck, and reappear the
  // moment the presenter moves the mouse again.
  const wakeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(
      () => setControlsVisible(false),
      3000,
    );
  }, []);

  useEffect(() => {
    if (!presenting) return;
    wakeControls();
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [presenting, wakeControls]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/live-sessions/${params.id}`, {
        cache: 'no-store',
      });
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (response.status === 404) {
        setStatus('not-found');
        return;
      }
      if (!response.ok) {
        setStatus('error');
        return;
      }
      setData(await response.json());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [params.id, router]);

  const loadQuestions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/live-sessions/${params.id}/questions`,
        { cache: 'no-store' },
      );
      if (!response.ok) return;
      setQuestions(await response.json());
    } catch {
      // Best-effort - the panel just stays empty until the next successful load or broadcast.
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    if (!params.id) return;
    const client = supabase();
    const channel = client.channel(`live-session:${params.id}`);
    channel
      .on('broadcast', { event: 'poll:opened' }, ({ payload }) => {
        setData((previous) =>
          previous
            ? { ...previous, poll: payload as LiveSessionOwnerState['poll'] }
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
            ? { ...previous, pulse: payload as LiveSessionOwnerState['pulse'] }
            : previous,
        );
      })
      // Deliberately NOT listening for 'session:status' here - the presenter
      // is the only one who ever changes it (via handleStatusChange's own
      // optimistic update), and each PATCH's broadcast is sent from an
      // independent ephemeral connection that can land back on this same
      // client at an arbitrary, out-of-order time. Re-applying it here would
      // let a stale broadcast from an earlier click stomp a newer one -
      // exactly the "flickers back to the previous button" bug this avoids.
      // The audience page still listens, since students have no other way
      // to learn the status changed.
      .on('broadcast', { event: 'question:new' }, ({ payload }) => {
        setQuestions((previous) =>
          [...previous, payload as LiveQuestion].sort(sortQuestions),
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
      .on('broadcast', { event: 'question:moderated' }, ({ payload }) => {
        const { questionId, visibility } = payload as {
          questionId: string;
          visibility: LiveQuestion['visibility'];
        };
        setQuestions((previous) =>
          previous.map((item) =>
            item.id === questionId ? { ...item, visibility } : item,
          ),
        );
      })
      .on('broadcast', { event: 'reaction:sent' }, ({ payload }) => {
        const { kind } = payload as { kind: string };
        setReactionCounts((previous) => ({
          ...previous,
          [kind]: (previous[kind] ?? 0) + 1,
        }));
        pushReaction(kind);
      })
      // Online count via broadcast heartbeats, not Supabase's native
      // Presence - see usePresenceHeartbeat.ts for why. The audience page
      // sends 'presence:ping' every few seconds; this just tallies them.
      .on('broadcast', { event: 'presence:ping' }, ({ payload }) => {
        registerPing((payload as { participantId: string }).participantId);
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [params.id, pushReaction, registerPing]);

  const handleOpenPoll = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2 || isOpeningPoll) return;
    setIsOpeningPoll(true);
    try {
      const response = await fetch(`/api/live-sessions/${params.id}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          options: cleanOptions,
        }),
      });
      if (!response.ok) throw new Error();
      const poll = await response.json();
      setData((previous) => (previous ? { ...previous, poll } : previous));
      setShowComposer(false);
      setQuestion('');
      setOptions(['', '']);
    } catch {
      toast({
        title: t('error'),
        description: t('error_opening_poll'),
        variant: 'destructive',
      });
    } finally {
      setIsOpeningPoll(false);
    }
  };

  const handleStatusChange = async (next: LiveSessionStatus) => {
    if (!data || data.status === next || statusChangePending.current) return;
    statusChangePending.current = true;
    setChangingStatus(true);
    // Optimistic: flip the button state on click, like Slido does, instead
    // of waiting on the round trip - roll back only if the write fails.
    const previousStatus = data.status;
    setData((previous) =>
      previous ? { ...previous, status: next } : previous,
    );
    try {
      const response = await fetch(`/api/live-sessions/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setData((previous) =>
        previous ? { ...previous, status: previousStatus } : previous,
      );
      toast({
        title: t('error'),
        description: t('error_updating_session'),
        variant: 'destructive',
      });
    } finally {
      statusChangePending.current = false;
      setChangingStatus(false);
    }
  };

  const copyJoinLink = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/live/${data.joinCode}`,
      );
      toast({ title: t('link_copied') });
    } catch {
      toast({
        title: t('error'),
        description: t('live_copy_error'),
        variant: 'destructive',
      });
    }
  };

  const handleDeckFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || uploadingDeck) return;
    setUploadingDeck(true);
    try {
      const client = supabase();
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();
      if (userError || !user) throw new Error('DECK_AUTH');
      const url = await uploadLiveDeck(client, user.id, file);
      const response = await fetch(`/api/live-sessions/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckUrl: url, deckPage: 1 }),
      });
      if (!response.ok) throw new Error('DECK_SAVE');
      setNumDeckPages(1);
      setDeckLoadError(false);
      setData((previous) =>
        previous ? { ...previous, deckUrl: url, deckPage: 1 } : previous,
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const key =
        code === 'DECK_TYPE'
          ? 'error_deck_type'
          : code === 'DECK_SIZE'
            ? 'error_deck_size'
            : code === 'DECK_STORAGE_NOT_READY'
              ? 'error_deck_storage_not_ready'
              : 'error_deck_upload';
      toast({ title: t('error'), description: t(key), variant: 'destructive' });
    } finally {
      setUploadingDeck(false);
    }
  };

  const handleDeckRemove = async () => {
    if (uploadingDeck) return;
    setUploadingDeck(true);
    try {
      const response = await fetch(`/api/live-sessions/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckUrl: null, deckPage: 1 }),
      });
      if (!response.ok) throw new Error();
      setData((previous) =>
        previous ? { ...previous, deckUrl: null, deckPage: 1 } : previous,
      );
    } catch {
      toast({
        title: t('error'),
        description: t('error_deck_upload'),
        variant: 'destructive',
      });
    } finally {
      setUploadingDeck(false);
    }
  };

  const changeDeckPage = async (nextPage: number) => {
    if (!data?.deckUrl || uploadingDeck) return;
    const clamped = Math.min(Math.max(1, nextPage), numDeckPages);
    if (clamped === data.deckPage) return;
    setData((previous) =>
      previous ? { ...previous, deckPage: clamped } : previous,
    );
    try {
      await fetch(`/api/live-sessions/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckPage: clamped }),
      });
    } catch {
      // Best-effort - the presenter's own view already advanced; a missed
      // persist just means a page refresh could land one page behind.
    }
  };

  const enterPresentation = async () => {
    if (!data?.deckUrl) return;
    setPresenting(true);
    try {
      await presentRef.current?.requestFullscreen();
    } catch {
      // Fullscreen can be denied or unsupported (e.g. some mobile browsers) -
      // the fixed-position overlay below still gives the full-bleed view
      // either way, it just won't hide the browser chrome too.
    }
  };

  const exitPresentation = () => {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    setPresenting(false);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!presenting || !data) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        void changeDeckPage(data.deckPage + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void changeDeckPage(data.deckPage - 1);
      } else if (event.key === 'Escape') {
        exitPresentation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presenting, data?.deckPage, numDeckPages]);

  const handleModerate = async (item: LiveQuestion) => {
    if (moderatingId) return;
    const nextVisibility =
      item.visibility === 'public' ? 'author_only' : 'public';
    setModeratingId(item.id);
    try {
      const response = await fetch(
        `/api/live-sessions/${params.id}/questions/${item.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility: nextVisibility }),
        },
      );
      if (!response.ok) throw new Error();
      setQuestions((previous) =>
        previous.map((entry) =>
          entry.id === item.id
            ? { ...entry, visibility: nextVisibility }
            : entry,
        ),
      );
    } catch {
      toast({
        title: t('error'),
        description: t('error_updating_session'),
        variant: 'destructive',
      });
    } finally {
      setModeratingId(null);
    }
  };

  const openQuizPicker = async () => {
    setShowQuizPicker(true);
    if (quizzes !== null) return;
    setQuizzesLoading(true);
    setQuizPickerError('');
    try {
      const response = await fetch('/api/quizzes', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      setQuizzes(await response.json());
    } catch {
      setQuizPickerError(t('error_loading_quizzes'));
    } finally {
      setQuizzesLoading(false);
    }
  };

  const pickQuizQuestion = (picked: QuizQuestion) => {
    setQuestion(picked.questionText);
    setOptions(picked.options.slice(0, 6).map((option) => option.text));
    setShowQuizPicker(false);
    setShowComposer(true);
  };

  if (status === 'loading') {
    return <LivePageState presenter loading message={t('live_loading')} />;
  }
  if (status === 'not-found' || status === 'error') {
    return (
      <LivePageState
        presenter
        message={t(
          status === 'not-found'
            ? 'live_session_not_found'
            : 'live_session_error',
        )}
      >
        <Button variant="outline" onClick={() => void load()}>
          {t('try_again')}
        </Button>
      </LivePageState>
    );
  }
  if (!data) return null;

  const pulseAvg = data.pulse.pulseAverage;
  const pulsePercent = pulseAvg === null ? 50 : ((pulseAvg - 1) / 4) * 100;
  const visibleQuestions = [...questions].sort(sortQuestions);

  return (
    <div className="min-h-screen bg-background">
      <LiveHeader presenter />
      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="app-kicker mb-2">{t('live_workspace')}</p>
            <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
              {data.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SessionStatus status={data.status} />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-4 w-4" />
              {t('live_online_count', { count: onlineCount })}
            </span>
          </div>
        </div>
        <section
          aria-label={t('live_session_controls')}
          className="app-panel flex flex-wrap items-center justify-between gap-4 p-4"
        >
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                {t('live_share_title')}
              </p>
              <p className="font-mono text-2xl font-semibold tracking-[0.18em]">
                {data.joinCode}
              </p>
            </div>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => void copyJoinLink()}
            >
              <Copy className="mr-2 h-4 w-4" />
              {t('live_copy_link')}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="min-h-11"
              disabled={changingStatus}
              onClick={() =>
                void handleStatusChange(
                  data.status === 'open' ? 'paused' : 'open',
                )
              }
            >
              {changingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : data.status === 'open' ? (
                <Pause className="mr-2 h-4 w-4" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {t(
                data.status === 'open'
                  ? 'live_action_paused'
                  : data.status === 'paused'
                    ? 'live_resume'
                    : 'live_reopen',
              )}
            </Button>
            {data.status !== 'closed' && (
              <EndSessionButton
                disabled={changingStatus}
                onConfirm={() => void handleStatusChange('closed')}
              />
            )}
          </div>
        </section>
        {data.status !== 'open' && (
          <p
            role="status"
            className="rounded-xl border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground"
          >
            {t(
              data.status === 'paused'
                ? 'live_paused_hint'
                : 'live_closed_hint',
            )}
          </p>
        )}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            <Card className="min-w-0">
              <CardContent className="p-5 sm:p-6 md:pt-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    {t('live_current_poll')}
                  </h2>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs tabular-nums">
                    {data.poll?.voteTotal ?? 0} {t('live_answered')}
                  </span>
                </div>
                {data.poll ? (
                  <>
                    <p className="mb-6 break-words text-xl font-semibold leading-relaxed tracking-tight sm:text-2xl">
                      {data.poll.question}
                    </p>
                    <div className="space-y-3">
                      {data.poll.options.map((option, index) => {
                        const count = data.poll?.voteCounts[index] ?? 0;
                        const total = data.poll?.voteTotal ?? 0;
                        const pct =
                          total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div
                            key={index}
                            className="rounded-xl border p-3 sm:p-4"
                          >
                            <div className="mb-3 flex items-start gap-3 text-sm">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs">
                                {String.fromCharCode(65 + index)}
                              </span>
                              <span className="min-w-0 flex-1 break-words">
                                {option}
                              </span>
                              <span className="shrink-0 font-mono text-xs tabular-nums">
                                {pct}%{' '}
                                <span className="text-muted-foreground">
                                  ({count})
                                </span>
                              </span>
                            </div>
                            <div
                              role="meter"
                              aria-label={option}
                              aria-valuenow={pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              className="h-1.5 overflow-hidden rounded-full bg-muted"
                            >
                              <div
                                className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {data.poll.voteTotal === 0 && (
                      <p className="mt-4 text-xs text-muted-foreground">
                        {t('live_results_empty')}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="py-8 text-sm text-muted-foreground">
                    {t('live_no_active_poll')}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                  <Button
                    className="min-h-11"
                    onClick={() => setShowComposer(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('live_new_poll')}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={() => void openQuizPicker()}
                  >
                    <ListChecks className="mr-2 h-4 w-4" />
                    {t('live_load_from_quiz')}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardContent className="p-5 md:pt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Presentation className="h-4 w-4 text-muted-foreground" />
                    {t('live_deck_title')}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) => void handleDeckFileChange(event)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      disabled={uploadingDeck}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingDeck ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileUp className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {t(
                        data.deckUrl ? 'live_deck_replace' : 'live_deck_upload',
                      )}
                    </Button>
                    {data.deckUrl && !deckLoadError && (
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-11"
                        onClick={() => void enterPresentation()}
                      >
                        <Maximize className="mr-1.5 h-3.5 w-3.5" />
                        {t('live_present_fullscreen')}
                      </Button>
                    )}
                    {data.deckUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-11 min-w-11"
                        aria-label={t('live_deck_remove')}
                        disabled={uploadingDeck}
                        onClick={() => void handleDeckRemove()}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {data.deckUrl ? (
                  deckLoadError ? (
                    <div className="space-y-1 py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        {t('live_deck_load_error')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="overflow-hidden rounded-lg border bg-black/5">
                        <DeckViewer
                          url={data.deckUrl}
                          page={data.deckPage}
                          className="h-[35vh] min-h-[200px] w-full lg:h-[42vh]"
                          onNumPages={setNumDeckPages}
                          onError={() => setDeckLoadError(true)}
                        />
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11 min-w-11"
                          aria-label={t('live_deck_prev')}
                          disabled={data.deckPage <= 1}
                          onClick={() => void changeDeckPage(data.deckPage - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="font-mono text-xs text-muted-foreground">
                          {t('live_deck_page_of', {
                            current: data.deckPage,
                            total: numDeckPages,
                          })}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11 min-w-11"
                          aria-label={t('live_deck_next')}
                          disabled={data.deckPage >= numDeckPages}
                          onClick={() => void changeDeckPage(data.deckPage + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center">
                    <Presentation className="mb-3 h-7 w-7 text-muted-foreground" />
                    <p className="text-sm font-medium">{t('live_deck_none')}</p>
                    <p className="mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
                      {t('live_deck_hint')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <aside
            aria-label={t('live_participation')}
            className="min-w-0 space-y-6"
          >
            <Card>
              <CardContent className="p-5 md:pt-6">
                <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  {t('live_pulse_title')}
                </h2>
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">
                    {pulseAvg === null ? '—' : pulseAvg.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / 5 · {data.pulse.pulseTotal} {t('live_answered')}
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-200 via-muted to-amber-300">
                  {pulseAvg !== null && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
                      style={{ left: `${pulsePercent}%` }}
                    />
                  )}
                </div>
                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>{t('live_pulse_easy')}</span>
                  <span>{t('live_pulse_ok')}</span>
                  <span>{t('live_pulse_hard')}</span>
                </div>
                {pulseAvg === null && (
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    {t('live_pulse_empty')}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardContent className="p-5 md:pt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    {t('live_qa_title')}
                  </h2>
                  <span className="font-mono text-xs text-muted-foreground">
                    {questions.length}
                  </span>
                </div>
                {visibleQuestions.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t('live_qa_panel_empty')}
                  </p>
                ) : (
                  <ul className="max-h-[460px] space-y-2 overflow-y-auto">
                    {visibleQuestions.map((item) => (
                      <li
                        key={item.id}
                        className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${item.visibility === 'author_only' ? 'opacity-60' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {t(`live_qa_lens_${item.lens}` as const)}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              ▲ {item.upvotes}
                            </span>
                          </div>
                          <p className="break-words">{item.text}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-11 min-w-11 shrink-0"
                          disabled={moderatingId === item.id}
                          onClick={() => void handleModerate(item)}
                          aria-label={t(
                            item.visibility === 'public'
                              ? 'live_qa_moderate_hide'
                              : 'live_qa_moderate_show',
                          )}
                        >
                          {item.visibility === 'public' ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {REACTION_KINDS.some((kind) => reactionCounts[kind]) && (
              <div className="app-panel p-5">
                <h2 className="mb-3 text-sm font-semibold">
                  {t('live_reactions_title')}
                </h2>
                <div className="flex flex-wrap gap-3">
                  {REACTION_KINDS.filter((kind) => reactionCounts[kind]).map(
                    (kind) => (
                      <span
                        key={kind}
                        className="rounded-lg bg-muted px-3 py-2 text-sm"
                        title={t(`live_reaction_${kind}`)}
                      >
                        {REACTION_EMOJI[kind]}{' '}
                        <span className="font-mono">
                          {reactionCounts[kind]}
                        </span>
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
      <Dialog open={showComposer} onOpenChange={setShowComposer}>
        <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('live_new_poll')}</DialogTitle>
            <DialogDescription>{t('live_options_hint')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleOpenPoll} className="space-y-3">
            <div>
              <Label htmlFor="poll-question">
                {t('live_poll_question_label')}
              </Label>
              <Textarea
                id="poll-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={2}
                maxLength={500}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t('live_poll_options_label')}</Label>
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    className="h-11"
                    aria-label={`${t('live_poll_option_placeholder')} ${String.fromCharCode(65 + index)}`}
                    value={option}
                    maxLength={120}
                    onChange={(event) =>
                      setOptions((previous) =>
                        previous.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    placeholder={`${t('live_poll_option_placeholder')} ${String.fromCharCode(65 + index)}`}
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('live_remove_option', {
                        option: String.fromCharCode(65 + index),
                      })}
                      onClick={() =>
                        setOptions((previous) =>
                          previous.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOptions((previous) => [...previous, ''])}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {t('live_add_option')}
                </Button>
              )}
            </div>
            <Button
              type="submit"
              className="min-h-11"
              disabled={
                isOpeningPoll ||
                !question.trim() ||
                options.filter((option) => option.trim()).length < 2
              }
            >
              {isOpeningPoll && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('live_open_poll')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ReactionBurstOverlay
        reactions={reactions}
        className="fixed inset-0 z-[60]"
      />

      {presenting && data.deckUrl && (
        <div
          ref={presentRef}
          className="fixed inset-0 z-50 bg-black"
          onMouseMove={wakeControls}
          onFocusCapture={wakeControls}
          onTouchStart={wakeControls}
        >
          {/* The deck fills the entire screen - the header/footer below
              float on top of it rather than squeezing it into a smaller
              box, so the projected slide is genuinely edge-to-edge. */}
          {deckLoadError ? (
            <p className="flex h-full items-center justify-center text-sm text-white/70">
              {t('live_deck_load_error')}
            </p>
          ) : (
            <DeckViewer
              url={data.deckUrl}
              page={data.deckPage}
              className="h-full w-full"
              onNumPages={setNumDeckPages}
              onError={() => setDeckLoadError(true)}
            />
          )}

          <div
            className={`absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-3 bg-black/70 px-4 py-2 text-white transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold">{data.title}</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.status === 'open' ? 'bg-emerald-700' : data.status === 'paused' ? 'bg-amber-500/90' : 'bg-white/20'}`}
              >
                {t(`live_status_${data.status}` as const)}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-white/70">
                <Users className="h-3.5 w-3.5" />
                {t('live_online_count', { count: onlineCount })}
              </span>
              <span className="font-mono text-xs text-white/70 tracking-widest">
                {data.joinCode}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={exitPresentation}
            >
              <Minimize className="mr-1.5 h-3.5 w-3.5" />
              {t('live_exit_presentation')}
            </Button>
          </div>

          <div
            className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-black/70 px-4 py-3 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
              aria-label={t('live_deck_prev')}
              disabled={data.deckPage <= 1}
              onClick={() => void changeDeckPage(data.deckPage - 1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="font-mono text-sm text-white/80">
              {t('live_deck_page_of', {
                current: data.deckPage,
                total: numDeckPages,
              })}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
              aria-label={t('live_deck_next')}
              disabled={data.deckPage >= numDeckPages}
              onClick={() => void changeDeckPage(data.deckPage + 1)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showQuizPicker} onOpenChange={setShowQuizPicker}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('live_load_from_quiz_title')}</DialogTitle>
            <DialogDescription>
              {t('live_load_from_quiz_pick_question')}
            </DialogDescription>
          </DialogHeader>
          {quizzesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : quizPickerError ? (
            <p
              role="alert"
              className="py-6 text-center text-sm text-destructive"
            >
              {quizPickerError}
            </p>
          ) : !quizzes || quizzes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('live_load_from_quiz_empty')}
            </p>
          ) : (
            <div className="space-y-4">
              {quizzes.map((quiz) => (
                <div key={quiz.id}>
                  <p className="mb-1.5 text-sm font-semibold">{quiz.title}</p>
                  <div className="space-y-1">
                    {quiz.questions.map((quizQuestion, index) => (
                      <button
                        key={quizQuestion.id}
                        type="button"
                        onClick={() => pickQuizQuestion(quizQuestion)}
                        className="block min-h-11 w-full whitespace-normal break-words rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:border-foreground/30"
                      >
                        {index + 1}. {quizQuestion.questionText}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
