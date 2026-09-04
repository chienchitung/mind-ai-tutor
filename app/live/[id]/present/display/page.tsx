'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Maximize, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import type { LiveSessionOwnerState } from '@/lib/live-session';
import type { InkPoint, InkStroke, PresentationTool } from '@/lib/presentation-annotations';
import { DeckViewer } from '@/components/live/DeckViewer';
import { RemoteInkOverlay } from '@/components/live/RemoteInkOverlay';
import { SpotlightOverlay, type Spotlight } from '@/components/live/SpotlightOverlay';
import { ReactionBurstOverlay, useReactionBursts } from '@/components/live/ReactionBurst';
import { useOnlinePresenceCount } from '@/components/live/usePresenceHeartbeat';
import { LivePageState } from '@/components/live/LiveSessionUI';

interface LiveDraft {
  tool: PresentationTool;
  color: string;
  width: number;
  draft: InkPoint[];
  pointer: InkPoint | null;
}

/**
 * The audience-safe half of dual-screen presenting: opened as a second
 * window (dragged onto a projector/external display) by the presenter's
 * control page. Mostly a passive mirror - deck, live ink, reactions, and
 * the same low-sensitivity online-count signal the control page shows -
 * plus one explicit exception: a SpotlightOverlay the presenter can turn
 * on/off from the control page to reveal a poll's results or a curated,
 * already-public set of questions. No Q&A moderation queue, no poll
 * controls, no pulse/difficulty feedback ever reach here - that stays on
 * the control window, on the presenter's own screen.
 */
export default function PresentDisplayPage() {
  const params = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error' | 'ended'>('loading');
  const [title, setTitle] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [deckUrl, setDeckUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [deckLoadError, setDeckLoadError] = useState(false);
  const [entered, setEntered] = useState(false);
  const [strokesByPage, setStrokesByPage] = useState<Record<number, InkStroke[]>>({});
  const [live, setLive] = useState<LiveDraft | null>(null);
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { reactions, push: pushReaction } = useReactionBursts();
  const { onlineCount, registerPing } = useOnlinePresenceCount();

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/live-sessions/${params.id}`, { cache: 'no-store' });
      if (response.status === 404) {
        setStatus('not-found');
        return;
      }
      if (!response.ok) {
        setStatus('error');
        return;
      }
      const data: LiveSessionOwnerState = await response.json();
      setTitle(data.title);
      setJoinCode(data.joinCode);
      setDeckUrl(data.deckUrl);
      setPage(data.deckPage);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!params.id) return;
    const client = supabase();
    const channel = client.channel(`live-session:${params.id}`);
    channel
      .on('broadcast', { event: 'deck:sync' }, ({ payload }) => {
        const { page: nextPage, deckUrl: nextUrl } = payload as { page: number; deckUrl: string | null };
        setPage(nextPage);
        setDeckUrl(nextUrl);
        setDeckLoadError(false);
      })
      .on('broadcast', { event: 'annotation:sync' }, ({ payload }) => {
        const { page: strokePage, strokes } = payload as { page: number; strokes: InkStroke[] };
        setStrokesByPage((previous) => ({ ...previous, [strokePage]: strokes }));
      })
      .on('broadcast', { event: 'annotation:live' }, ({ payload }) => {
        setLive(payload as LiveDraft);
      })
      .on('broadcast', { event: 'reaction:sent' }, ({ payload }) => {
        const { kind } = payload as { kind: string };
        pushReaction(kind);
      })
      .on('broadcast', { event: 'presence:ping' }, ({ payload }) => {
        registerPing((payload as { participantId: string }).participantId);
      })
      // The presenter's explicit "reveal" moment - only ever fires with
      // already-public content (a poll's own results, or questions the
      // presenter already approved), never the moderation queue.
      .on('broadcast', { event: 'spotlight:show' }, ({ payload }) => {
        setSpotlight(payload as Spotlight);
      })
      .on('broadcast', { event: 'spotlight:hide' }, () => setSpotlight(null))
      .on('broadcast', { event: 'session:deleted' }, () => setStatus('ended'))
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [params.id, pushReaction, registerPing]);

  const enterFullscreen = async () => {
    try {
      await containerRef.current?.requestFullscreen?.();
    } catch {
      // Fullscreen can be denied or unsupported - the fixed full-bleed
      // layout below still fills the window either way, it just won't
      // hide the browser chrome too.
    }
    setEntered(true);
  };

  if (status === 'loading') {
    return <LivePageState presenter loading message={t('live_loading')} />;
  }
  if (status === 'not-found' || status === 'error' || status === 'ended') {
    return (
      <LivePageState
        presenter
        message={t(
          status === 'not-found'
            ? 'live_session_not_found'
            : status === 'ended'
              ? 'live_display_ended'
              : 'live_session_error',
        )}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 h-[100dvh] w-screen overflow-hidden bg-black text-white"
    >
      {!entered && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center">
          <p className="max-w-sm truncate text-sm text-white/70">{title}</p>
          <Button onClick={() => void enterFullscreen()} className="min-h-11">
            <Maximize className="mr-2 h-4 w-4" />
            {t('live_display_enter_fullscreen')}
          </Button>
        </div>
      )}
      <div className="absolute inset-x-0 top-0 z-10 p-4">
        <div className="inline-block rounded-xl bg-black/70 px-3 py-2 backdrop-blur-sm">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-white/70">
            {t('live_join_code_label')} <span className="font-mono tracking-widest text-white">{joinCode}</span>
          </p>
        </div>
      </div>
      {deckUrl ? (
        deckLoadError ? (
          <p role="alert" className="flex h-full items-center justify-center p-6 text-center text-white/80">
            {t('live_deck_load_error')}
          </p>
        ) : (
          <DeckViewer
            url={deckUrl}
            page={page}
            onError={() => setDeckLoadError(true)}
            className="h-full w-full"
            overlay={
              <RemoteInkOverlay
                strokes={strokesByPage[page] ?? []}
                draft={live?.draft ?? []}
                pointer={live?.pointer ?? null}
                tool={live?.tool ?? 'cursor'}
                color={live?.color ?? '#fb7185'}
                width={live?.width ?? 3}
                label={t('live_ink_surface')}
              />
            }
          />
        )
      ) : (
        <p className="flex h-full items-center justify-center p-6 text-center text-white/60">
          {t('live_display_waiting_for_deck')}
        </p>
      )}
      <ReactionBurstOverlay reactions={reactions} className="absolute inset-0 z-10" />
      {spotlight && <SpotlightOverlay spotlight={spotlight} />}
      {onlineCount > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-[11px] leading-5 text-white/80 backdrop-blur-sm">
          <Users className="h-3 w-3" aria-hidden="true" />
          {onlineCount}
        </div>
      )}
    </div>
  );
}
