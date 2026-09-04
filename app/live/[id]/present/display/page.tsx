"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/app/contexts/LanguageContext";
import type {
  InkPoint,
  InkStroke,
  PresentationTool,
} from "@/lib/presentation-annotations";
import { DeckViewer } from "@/components/live/DeckViewer";
import { RemoteInkOverlay } from "@/components/live/RemoteInkOverlay";
import {
  ReactionBurstOverlay,
  useReactionBursts,
} from "@/components/live/ReactionBurst";
import { usePresentationSnapshot } from "@/components/live/usePresentationSnapshot";
import { PresentationContent } from "@/components/live/PresentationContent";
import { JoinQRCode } from "@/components/live/JoinQRCode";

interface LiveDraft {
  tool: PresentationTool;
  color: string;
  width: number;
  draft: InkPoint[];
  pointer: InkPoint | null;
}
export default function PresentDisplayPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const zh = language === "zh-TW";
  const { snapshot, error, refresh } = usePresentationSnapshot(
    `/api/live-sessions/${id}/presentation`,
    id,
  );
  const [joinCode, setJoinCode] = useState("");
  const [entered, setEntered] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [deckError, setDeckError] = useState(false);
  const [ink, setInk] = useState<{
    page: number;
    deckUrl: string | null;
    strokes: InkStroke[];
  } | null>(null);
  const [live, setLive] = useState<
    (LiveDraft & { page: number; deckUrl: string | null }) | null
  >(null);
  const [connected, setConnected] = useState(false);
  const lastInk = useRef(0);
  const readyRef = useRef(false);
  const inkChannelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    readyRef.current = !!snapshot && !error;
    if (readyRef.current) inkChannelRef.current?.postMessage({ type: "ready" });
  }, [snapshot, error]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { reactions, push: pushReaction } = useReactionBursts();
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/live-sessions/${id}`, {
      cache: "no-store",
      signal: abort.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => {
        if (value) setJoinCode(value.joinCode);
      })
      .catch(() => {});
    return () => abort.abort();
  }, [id]);
  useEffect(() => {
    setDeckError(false);
    setLive(null);
  }, [snapshot?.deckPage, snapshot?.deckUrl]);
  useEffect(() => {
    const handle = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handle);
    return () => document.removeEventListener("fullscreenchange", handle);
  }, []);
  useEffect(() => {
    const client = supabase();
    const channel = client.channel(`live-session:${id}`);
    channel
      .on("broadcast", { event: "reaction:sent" }, ({ payload }) =>
        pushReaction(payload.kind, payload.reactionId),
      )
      .on("broadcast", { event: "presentation:changed" }, () => void refresh())
      .on("broadcast", { event: "deck:sync" }, () => void refresh())
      .on("broadcast", { event: "session:status" }, () => void refresh())
      .on("broadcast", { event: "session:deleted" }, () => void refresh())
      .subscribe((state) => {
        if (state === "SUBSCRIBED") void refresh();
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, [id, pushReaction, refresh]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`live-ink:${id}`);
    inkChannelRef.current = channel;
    let idle: ReturnType<typeof setTimeout> | undefined;
    channel.onmessage = ({ data }) => {
      if (data?.type === "ink" && Array.isArray(data.strokes)) {
        lastInk.current = Date.now();
        setConnected(true);
        setInk(data);
      }
      if (
        data?.type === "scroll" &&
        (data.direction === 1 || data.direction === -1)
      ) {
        const content = containerRef.current?.querySelector(
          "[data-projection-scroll]",
        );
        content?.scrollBy({
          top: data.direction * content.clientHeight * 0.7,
          behavior: "smooth",
        });
      }
      if (data?.type === "live") {
        setLive({ ...data.payload, page: data.page, deckUrl: data.deckUrl });
        clearTimeout(idle);
        idle = setTimeout(() => setLive(null), 1200);
      }
    };
    const ping = () => {
      if (readyRef.current) {
        channel.postMessage({ type: "ready" });
        const content = containerRef.current?.querySelector(
          "[data-projection-scroll]",
        );
        if (content)
          channel.postMessage({
            type: "viewport",
            width: content.clientWidth,
            height: content.clientHeight,
            up: content.scrollTop > 1,
            down:
              content.scrollTop + content.clientHeight <
              content.scrollHeight - 1,
          });
      }
      setConnected(Date.now() - lastInk.current < 6000);
    };
    ping();
    const timer = setInterval(ping, 2000);
    return () => {
      clearInterval(timer);
      clearTimeout(idle);
      channel.close();
      inkChannelRef.current = null;
    };
  }, [id]);
  const enter = async () => {
    setEntered(true);
    try {
      await containerRef.current?.requestFullscreen?.();
    } catch {
      /* The window remains usable without native fullscreen. */
    }
  };
  if (!snapshot)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <Button onClick={() => void refresh()}>
          {error
            ? zh
              ? "載入失敗，重試"
              : "Retry loading"
            : zh
              ? "正在連線…"
              : "Connecting…"}
        </Button>
      </main>
    );
  const inkMatches =
    ink?.page === snapshot.deckPage && ink?.deckUrl === snapshot.deckUrl;
  const liveMatches =
    live?.page === snapshot.deckPage && live?.deckUrl === snapshot.deckUrl;
  const hidden = snapshot.mode === "blank" || snapshot.status === "closed";
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-slate-950 text-white"
    >
      {!entered && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-slate-950 p-8 text-center">
          <h1 className="text-2xl">{snapshot.title}</h1>
          <p>
            {zh
              ? "將此視窗拖到投影螢幕，再開始全螢幕。"
              : "Move this window to the projector, then enter fullscreen."}
          </p>
          <Button onClick={() => void enter()}>
            <Maximize className="mr-2 h-4 w-4" />
            {zh ? "開始投影" : "Start presenting"}
          </Button>
        </div>
      )}
      {snapshot.status === "closed" || snapshot.mode !== "deck" ? (
        <div className={hidden ? "h-full" : "h-[calc(100dvh-5rem)]"}>
          <PresentationContent
            key={`${snapshot.mode}:${snapshot.poll?.pollId}:${snapshot.questions.map((q) => q.id).join()}`}
            snapshot={snapshot}
          />
        </div>
      ) : snapshot.deckUrl ? (
        deckError ? (
          <div role="alert" className="flex h-full items-center justify-center">
            <Button
              onClick={() => {
                setDeckError(false);
                void refresh();
              }}
            >
              {zh ? "簡報載入失敗，重試" : "Retry slides"}
            </Button>
          </div>
        ) : (
          <DeckViewer
            url={snapshot.deckUrl}
            page={snapshot.deckPage}
            className="h-[calc(100dvh-5rem)] w-full"
            onError={() => setDeckError(true)}
            overlay={
              <RemoteInkOverlay
                strokes={inkMatches ? ink!.strokes : []}
                draft={liveMatches ? live!.draft : []}
                pointer={liveMatches ? live!.pointer : null}
                tool={liveMatches ? live!.tool : "cursor"}
                color={liveMatches ? live!.color : "#fb7185"}
                width={liveMatches ? live!.width : 3}
                label={zh ? "簡報筆跡" : "Slide annotations"}
              />
            }
          />
        )
      ) : (
        <div className="flex h-full items-center justify-center text-3xl">
          {zh ? "歡迎加入，等待老師開始" : "Welcome! Waiting for the teacher"}
        </div>
      )}
      {!hidden && (
        <footer className="absolute inset-x-0 bottom-0 flex h-20 items-center justify-between gap-4 border-t border-white/10 bg-slate-950 px-6">
          <div className="min-w-0">
            <p className="truncate text-sm text-white/60">{snapshot.title}</p>
            <p className="text-xl">
              mindaitutor.com/live ·{" "}
              <strong className="font-mono tracking-widest text-teal-300">
                {joinCode}
              </strong>
            </p>
          </div>
          {joinCode && <JoinQRCode code={joinCode} />}
        </footer>
      )}
      {!hidden && (
        <ReactionBurstOverlay
          reactions={reactions}
          className="pointer-events-none absolute inset-0 z-10"
        />
      )}
      {(error || !connected) && entered && !hidden && (
        <p
          role="status"
          className="absolute right-3 top-3 rounded bg-amber-950 px-3 py-2 text-xs"
        >
          {error
            ? zh
              ? "連線中斷，正在重新同步"
              : "Connection lost. Reconnecting"
            : zh
              ? "老師控制台未連線"
              : "Presenter disconnected"}
        </p>
      )}
      {entered && !fullscreen && (
        <Button
          className="absolute right-3 top-14 z-40"
          variant="secondary"
          onClick={() => void enter()}
          aria-label={zh ? "回到全螢幕" : "Enter fullscreen"}
        >
          <Maximize className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
