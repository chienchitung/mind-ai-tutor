'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
  Users,
  BarChart3,
  MessageSquare,
  Presentation,
  Activity,
  MonitorPlay,
  MousePointer2,
  ScanLine,
  Pencil,
  Eraser,
  Undo2,
  Redo2,
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
import { deleteLiveDeck, uploadLiveDeck } from '@/lib/live-deck-storage';
import { annotationReducer, EMPTY_INK, type InkPoint, type InkStroke, type PresentationTool } from '@/lib/presentation-annotations';
import { PresentationControls } from '@/components/live/PresentationControls';
import { DeckViewer } from '@/components/live/DeckViewer';
import { AnnotationLayer } from '@/components/live/AnnotationLayer';
import { readAnnotationCommand } from '@/lib/live-annotation-command';
import { PresentationStage } from '@/components/live/PresentationStage';
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
const CONTROL_TOOLS = [
  { value: 'cursor', icon: MousePointer2 },
  { value: 'laser', icon: ScanLine },
  { value: 'pen', icon: Pencil },
  { value: 'eraser', icon: Eraser },
] as const;
const CONTROL_COLORS = ['#fb7185', '#facc15', '#38bdf8', '#ffffff'] as const;
// Idle (draft cleared, pointer hidden) always sends immediately - dropping
// that one would leave stale ink stuck on the projected display window.
const LIVE_SEND_THROTTLE_MS = 33;

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
  const presentationTriggerRef = useRef<HTMLElement | null>(null);
  // Tracks whether THIS presentation actually reached native fullscreen, so
  // the fullscreenchange handler below can tell "the user just exited
  // fullscreen" apart from "fullscreen was denied/unsupported and never
  // engaged" - both leave document.fullscreenElement falsy, but only the
  // former should close the overlay (see handleFullscreenChange).
  const wasFullscreenRef = useRef(false);

  // Dual-screen presenting: this page stays the presenter's own control
  // surface (Q&A moderation, poll picker, drawing input) while a second,
  // synchronized window (app/live/[id]/present/display) gets dragged onto a
  // projector/external display. The two windows sync over the same
  // realtime channel this page already subscribes to for polls/questions.
  const [dualDisplayOpen, setDualDisplayOpen] = useState(false);
  const displayWindowRef = useRef<Window | null>(null);
  const [controlTool, setControlTool] = useState<PresentationTool>('cursor');
  const [controlColor, setControlColor] = useState<string>(CONTROL_COLORS[0]);
  const [controlWidth] = useState(3);
  const [controlInk, dispatchControlInk] = useReducer(annotationReducer, {});
  const lastLiveSendRef = useRef(0);
  const [displayConnected, setDisplayConnected] = useState(false);
  const inkChannelRef = useRef<BroadcastChannel | null>(null);
  const lastDisplayPing = useRef(0);

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
      .on('broadcast', { event: 'session:deleted' }, () => { void load(); })
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
      .on('broadcast', { event: 'presentation:changed' }, () => window.dispatchEvent(new Event('live:presentation-refresh')))
      .subscribe((state) => { if (state === 'SUBSCRIBED') { void load(); void loadQuestions(); window.dispatchEvent(new Event('live:presentation-refresh')); } });
    return () => {
      void client.removeChannel(channel);
    };
  }, [params.id, pushReaction, registerPing, load, loadQuestions]);

  // Drawing stays on this browser's origin, never on the public student channel.
  // A refreshed display asks for the current ink; periodic replay repairs missed messages.
  const inkSnapshotRef = useRef({ page: data?.deckPage, deckUrl: data?.deckUrl, strokes: [] as InkStroke[], history: EMPTY_INK });
  useEffect(() => {
    inkSnapshotRef.current = { page: data?.deckPage, deckUrl: data?.deckUrl, strokes: (controlInk[data?.deckPage ?? 1] ?? EMPTY_INK).strokes, history: controlInk[data?.deckPage ?? 1] ?? EMPTY_INK };
    inkChannelRef.current?.postMessage({ type: 'ink', ...inkSnapshotRef.current });
  }, [controlInk, data?.deckPage, data?.deckUrl]);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`live-ink:${params.id}`);
    inkChannelRef.current = channel;
    channel.onmessage = ({ data: message }) => {
      if (message?.type === 'annotation-action') {
        const current = inkSnapshotRef.current;
        const action = readAnnotationCommand(message, current);
        if (action) {
          const history = annotationReducer({ [action.page]: current.history }, action)[action.page];
          inkSnapshotRef.current = { ...current, history, strokes: history.strokes };
          dispatchControlInk(action);
        }
        channel.postMessage({ type: 'ink', ...inkSnapshotRef.current });
      }
      if (message?.type === 'ready') {
        lastDisplayPing.current = Date.now();
        setDisplayConnected(true);
        channel.postMessage({ type: 'ink', ...inkSnapshotRef.current });
      }
    };
    const timer = setInterval(() => setDisplayConnected(Date.now() - lastDisplayPing.current < 6000), 2000);
    return () => { clearInterval(timer); channel.close(); inkChannelRef.current = null; };
  }, [params.id]);

  // Detects the presenter closing the projected window directly (not via
  // the "stop dual-screen" button) so the control-side toolbar disappears too.
  useEffect(() => {
    if (!dualDisplayOpen) return;
    const interval = setInterval(() => {
      if (!displayWindowRef.current || displayWindowRef.current.closed) {
        displayWindowRef.current = null;
        setDualDisplayOpen(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [dualDisplayOpen]);

  const openDisplayWindow = () => {
    const win = window.open(
      `/live/${params.id}/present/display`,
      `live-display-${params.id}`,
      'popup',
    );
    if (!win) {
      toast({
        title: t('error'),
        description: t('live_dual_screen_popup_blocked'),
        variant: 'destructive',
      });
      return;
    }
    displayWindowRef.current = win;
    setDualDisplayOpen(true);
  };

  const closeDisplayWindow = () => {
    displayWindowRef.current?.close();
    displayWindowRef.current = null;
    setDualDisplayOpen(false);
  };

  const broadcastLiveChange = useCallback(
    (live: { draft: InkPoint[]; pointer: InkPoint | null }) => {
      const now = Date.now();
      const isIdle = live.draft.length === 0 && live.pointer === null;
      if (!isIdle && now - lastLiveSendRef.current < LIVE_SEND_THROTTLE_MS) return;
      lastLiveSendRef.current = now;
      inkChannelRef.current?.postMessage({
        type: 'live', page: data?.deckPage, deckUrl: data?.deckUrl,
        payload: { tool: controlTool, color: controlColor, width: controlWidth, ...live },
      });
    },
    [controlTool, controlColor, controlWidth, data?.deckPage, data?.deckUrl],
  );

  // Shared by the composer Dialog (outside fullscreen) and the projection
  // panel's own inline composer (inside PresentationStage) - each keeps its
  // own draft-field state, but both open the poll the same way.
  const openPoll = async (pollQuestion: string, pollOptions: string[]): Promise<boolean> => {
    try {
      const response = await fetch(`/api/live-sessions/${params.id}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: pollQuestion, options: pollOptions }),
      });
      if (!response.ok) throw new Error();
      const poll = await response.json();
      setData((previous) => (previous ? { ...previous, poll } : previous));
      window.dispatchEvent(new Event('live:presentation-refresh'));
      return true;
    } catch {
      toast({
        title: t('error'),
        description: t('error_opening_poll'),
        variant: 'destructive',
      });
      return false;
    }
  };

  const handleOpenPoll = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2 || isOpeningPoll) return;
    setIsOpeningPoll(true);
    const ok = await openPoll(question.trim(), cleanOptions);
    setIsOpeningPoll(false);
    if (ok) {
      setShowComposer(false);
      setQuestion('');
      setOptions(['', '']);
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
      window.dispatchEvent(new Event('live:presentation-refresh'));
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
    let uploadedUrl: string | null = null;
    let deckClient: ReturnType<typeof supabase> | null = null;
    try {
      const client = supabase();
      deckClient = client;
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();
      if (userError || !user) throw new Error('DECK_AUTH');
      const url = await uploadLiveDeck(client, user.id, file);
      uploadedUrl = url;
      const response = await fetch(`/api/live-sessions/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckUrl: url, deckPage: 1 }),
      });
      if (!response.ok) throw new Error('DECK_SAVE');
      uploadedUrl = null;
      setNumDeckPages(1);
      setDeckLoadError(false);
      setData((previous) =>
        previous ? { ...previous, deckUrl: url, deckPage: 1 } : previous,
      );
    } catch (error) {
      // Upload and session PATCH are separate operations. Roll back a newly
      // uploaded object when the session could not persist its URL, otherwise
      // every transient API failure leaves an unreachable Storage object.
      if (uploadedUrl && deckClient) {
        await deleteLiveDeck(deckClient, uploadedUrl).catch((cleanupError) => {
          console.error('orphaned live deck cleanup failed:', cleanupError);
        });
      }
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
    presentationTriggerRef.current = document.activeElement as HTMLElement | null;
    wasFullscreenRef.current = false;
    // Mount the dialog before requesting fullscreen, while user activation is still valid.
    flushSync(() => setPresenting(true));
    try {
      await (presentRef.current ?? document.documentElement).requestFullscreen?.();
      wasFullscreenRef.current = !!document.fullscreenElement;
    } catch {
      // Fullscreen can be denied or unsupported (e.g. some mobile browsers) -
      // the fixed-position overlay below still gives the full-bleed view
      // either way, it just won't hide the browser chrome too. Left
      // wasFullscreenRef false so handleFullscreenChange doesn't mistake
      // this for an exit and close the overlay out from under it.
    }
  };

  const exitPresentation = () => {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    wasFullscreenRef.current = false;
    setPresenting(false);
    requestAnimationFrame(() => presentationTriggerRef.current?.focus({ preventScroll: true }));
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        wasFullscreenRef.current = true;
        return;
      }
      // document.fullscreenElement is also falsy when a request was simply
      // denied/unsupported and fullscreen was never engaged - only treat
      // this as an exit (and close the overlay) if we know we were
      // actually in fullscreen a moment ago.
      if (!wasFullscreenRef.current) return;
      wasFullscreenRef.current = false;
      setPresenting(false);
      requestAnimationFrame(() => presentationTriggerRef.current?.focus({ preventScroll: true }));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  // Shared by the modal quiz picker (outside fullscreen) and the
  // projection panel's own poll tab, which auto-triggers this the first
  // time it's viewed so the list is ready without an extra tap.
  const loadQuizzesOnce = async () => {
    if (quizzes !== null || quizzesLoading) return;
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

  const openQuizPicker = async () => {
    setShowQuizPicker(true);
    await loadQuizzesOnce();
  };

  const pickQuizQuestion = (picked: QuizQuestion) => {
    setQuestion(picked.questionText);
    setOptions(picked.options.slice(0, 6).map((option) => option.text));
    setShowQuizPicker(false);
    setShowComposer(true);
  };

  // The projection panel launches a poll straight from a saved question -
  // no intermediate review step, since the presenter is already mid-lecture
  // and the modal composer above sits at a lower z-index than the
  // fullscreen stage (it would render behind it, not on top).
  const pickQuizQuestionInPanel = (picked: QuizQuestion) => {
    void openPoll(picked.questionText, picked.options.slice(0, 6).map((option) => option.text));
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
  const controlHistory = controlInk[data.deckPage] ?? EMPTY_INK;

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
        <PresentationControls sessionId={params.id} questions={questions} connected={displayConnected} onOpen={openDisplayWindow} />
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
                    {data.deckUrl && !deckLoadError && (
                      <Button
                        type="button"
                        size="sm"
                        variant={dualDisplayOpen ? 'secondary' : 'outline'}
                        className="min-h-11"
                        aria-pressed={dualDisplayOpen}
                        title={t('live_dual_screen_hint')}
                        onClick={dualDisplayOpen ? closeDisplayWindow : openDisplayWindow}
                      >
                        <MonitorPlay className="mr-1.5 h-3.5 w-3.5" />
                        {t(dualDisplayOpen ? 'live_dual_screen_close' : 'live_dual_screen_present')}
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
                          overlay={
                            dualDisplayOpen ? (
                              <AnnotationLayer
                                strokes={controlHistory.strokes}
                                tool={controlTool}
                                color={controlColor}
                                width={controlWidth}
                                label={t('live_ink_surface')}
                                onCommit={(strokes) =>
                                  dispatchControlInk({ type: 'commit', page: data.deckPage, strokes })
                                }
                                onDrawingChange={() => {}}
                                onLiveChange={broadcastLiveChange}
                              />
                            ) : undefined
                          }
                        />
                      </div>
                      {dualDisplayOpen && (
                        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/30 p-2">
                          {CONTROL_TOOLS.map(({ value, icon: Icon }) => (
                            <Button
                              key={value}
                              type="button"
                              size="sm"
                              variant={controlTool === value ? 'secondary' : 'ghost'}
                              className="h-9 w-9 p-0"
                              aria-label={t(`live_tool_${value}`)}
                              aria-pressed={controlTool === value}
                              onClick={() => setControlTool(value)}
                            >
                              <Icon className="h-4 w-4" />
                            </Button>
                          ))}
                          <span className="mx-1 h-6 w-px bg-border" />
                          {CONTROL_COLORS.map((value) => (
                            <button
                              key={value}
                              type="button"
                              aria-label={value}
                              aria-pressed={controlColor === value}
                              className={`flex h-9 w-9 items-center justify-center rounded-md ${controlColor === value ? 'ring-2 ring-ring' : ''}`}
                              onClick={() => {
                                setControlColor(value);
                                setControlTool('pen');
                              }}
                            >
                              <span
                                className="h-5 w-5 rounded-full border border-black/10"
                                style={{ background: value }}
                              />
                            </button>
                          ))}
                          <span className="mx-1 h-6 w-px bg-border" />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0"
                            aria-label={t('live_ink_undo')}
                            disabled={!controlHistory.past.length}
                            onClick={() => dispatchControlInk({ type: 'undo', page: data.deckPage })}
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0"
                            aria-label={t('live_ink_redo')}
                            disabled={!controlHistory.future.length}
                            onClick={() => dispatchControlInk({ type: 'redo', page: data.deckPage })}
                          >
                            <Redo2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0"
                            aria-label={t('live_ink_clear')}
                            disabled={!controlHistory.strokes.length}
                            onClick={() => dispatchControlInk({ type: 'clear', page: data.deckPage })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {t('live_dual_screen_active')}
                          </span>
                        </div>
                      )}
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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    {t('live_qa_title')}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {questions.length}
                    </span>

                  </div>
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

      {data.deckUrl && <PresentationStage key={data.deckUrl} ref={presentRef} open={presenting}
        url={data.deckUrl} page={data.deckPage} numPages={numDeckPages} title={data.title} joinCode={data.joinCode}
        onExit={exitPresentation} onPageChange={(page) => void changeDeckPage(page)} onNumPages={setNumDeckPages}
        reactions={<ReactionBurstOverlay reactions={reactions} className="absolute inset-0 z-[75]" />}
        annotationState={controlInk} onAnnotationAction={dispatchControlInk}
        onLiveChange={live => inkChannelRef.current?.postMessage({ type: 'live', page: data.deckPage, deckUrl: data.deckUrl, payload: live })}
        onlineCount={onlineCount}
        poll={data.poll} questions={questions} moderatingId={moderatingId}
        onModerateQuestion={(item) => void handleModerate(item)}
        quizzes={quizzes} quizzesLoading={quizzesLoading} quizPickerError={quizPickerError}
        onLoadQuizzes={() => void loadQuizzesOnce()} onPickQuizQuestion={pickQuizQuestionInPanel} />}

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
