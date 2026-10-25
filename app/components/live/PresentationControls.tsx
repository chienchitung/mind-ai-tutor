"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
  EyeOff,
  Expand,
  MessageSquare,
  MonitorPlay,
  MonitorOff,
  Presentation,
  RefreshCw,
  Rows3,
  Square,
  Undo2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/lib/translations";
import { cn } from "@/lib/utils";
import {
  displayLabel,
  phaseLabel,
  type PresentationSnapshot,
} from "@/lib/live-presentation";
import { usePresentationSnapshot } from "./usePresentationSnapshot";
import { DeckViewer } from "./DeckViewer";
import { PresentationContent } from "./PresentationContent";
import type { LiveQuestion } from "@/lib/live-session";
// control_live_presentation always sets mode back to "poll" on a phase
// transition (see supabase/migrations/20260904051713_live_presentation_flow.sql),
// even if something else was on screen - mirrored here so the optimistic
// guess matches what the RPC will actually do.
function withPollPhase(
  prev: PresentationSnapshot,
  phase: "open" | "closed" | "results",
): PresentationSnapshot {
  if (!prev.poll) return prev;
  return { ...prev, mode: "poll", poll: { ...prev.poll, phase } };
}

type QuestionFilter = "pending" | "answered" | "hidden";

// The presenter workspace's layout owner: the projection toolbar on top, the
// page's own slide stage and poll card in the main column, and the projected
// preview, pulse and the single Q&A panel (moderation + projection) beside it.
// Every projection command needs the same snapshot, so the page hands its
// pieces in as slots rather than this component being split across columns.
export function PresentationControls({
  sessionId,
  questions,
  connected,
  onOpen,
  displayOpen,
  onClose,
  moderatingId = null,
  onModerate,
  stage,
  renderPoll,
  aside,
  localDeck,
}: {
  sessionId: string;
  questions: LiveQuestion[];
  connected: boolean;
  onOpen: () => void;
  /** Whether this page opened the dual-screen window (enables "close"). */
  displayOpen?: boolean;
  onClose?: () => void;
  moderatingId?: string | null;
  onModerate?: (question: LiveQuestion) => void;
  stage?: ReactNode;
  /** Wraps the poll-flow buttons in the page's own poll card. */
  renderPoll?: (flow: ReactNode) => ReactNode;
  aside?: ReactNode;
  /** The presenter's own slide position, which leads the saved one by a round trip. */
  localDeck?: { url: string | null; page: number };
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const zh = language === "zh-TW";
  const { snapshot, error, pending, command, retry } = usePresentationSnapshot(
    `/api/live-sessions/${sessionId}/presentation`,
    sessionId,
  );
  const offset = snapshot?.overview?.offset ?? 0;
  const pageSize = snapshot?.overview?.pageSize ?? 4;
  const sort = snapshot?.overview?.sort ?? "popular";
  const total = snapshot?.overview?.total ?? 0;
  const newCount = snapshot?.overview?.newCount ?? 0;
  const [displayMetrics, setDisplayMetrics] = useState({
    width: 1600,
    height: 820,
    up: false,
    down: false,
  });
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`live-ink:${sessionId}`);
    channel.onmessage = ({ data }) => {
      if (
        data?.type === "viewport" &&
        Number.isFinite(data.width) &&
        Number.isFinite(data.height) &&
        data.width > 0 &&
        data.height > 0
      ) {
        setDisplayMetrics({
          width: data.width,
          height: data.height,
          up: data.up === true,
          down: data.down === true,
        });
      }
    };
    return () => channel.close();
  }, [sessionId]);
  const showOverview = (nextOffset = 0, size = pageSize, order = sort) =>
    command({
      action: "show",
      mode: "questions",
      offset: nextOffset,
      pageSize: size,
      sort: order,
    });
  const [filter, setFilter] = useState<QuestionFilter>("pending");
  const disabled = pending || !snapshot || snapshot.status === "closed";
  const answeredIds = snapshot?.answeredIds ?? [];
  const publicQuestions = questions.filter((q) => q.visibility === "public");
  const pendingQuestions = publicQuestions.filter((q) => !answeredIds.includes(q.id));
  const answeredQuestions = publicQuestions.filter((q) => answeredIds.includes(q.id));
  const hiddenQuestions = questions.filter((q) => q.visibility !== "public");
  const listed =
    filter === "pending" ? pendingQuestions : filter === "answered" ? answeredQuestions : hiddenQuestions;
  const featuredId = snapshot?.mode === "question" ? snapshot.questions[0]?.id : undefined;
  const mode = snapshot?.mode;
  // Page turns are saved in the background; following the presenter's local
  // page keeps the preview in step with the slide instead of the last save.
  const previewPage = snapshot && localDeck && localDeck.url === snapshot.deckUrl ? localDeck.page : snapshot?.deckPage ?? 1;
  const scrollDisplay = (direction: number) => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`live-ink:${sessionId}`);
    channel.postMessage({ type: "scroll", direction });
    channel.close();
  };
  const showMode = (nextMode: "deck" | "blank" | "poll") =>
    void command({ action: "show", mode: nextMode }, (prev) => ({ ...prev, mode: nextMode }));

  const preview = (
    <div
      className="overflow-hidden rounded-lg bg-slate-950 text-white"
      style={{ aspectRatio: `${displayMetrics.width}/${displayMetrics.height}` }}
    >
      {snapshot?.mode === "deck" && snapshot.deckUrl ? (
        <DeckViewer url={snapshot.deckUrl} page={previewPage} className="h-full w-full" />
      ) : snapshot?.mode === "deck" ? (
        <p className="flex h-full items-center justify-center px-4 text-center text-xs text-white/70">
          {zh ? "尚未上傳簡報，可先投射投票或問題" : "No slides yet. You can still show polls or questions."}
        </p>
      ) : snapshot ? (
        <PresentationContent snapshot={snapshot} preview />
      ) : null}
    </div>
  );

  const pollFlow = snapshot?.poll ? (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {zh ? "投票流程" : "Poll flow"}
          <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs font-normal text-muted-foreground ring-1 ring-border">
            {phaseLabel(snapshot.poll.phase, zh)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {zh ? "先展示題目，收票後再公布比例" : "Show the question, then reveal results"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={disabled}
          variant={mode === "poll" ? "secondary" : "outline"}
          aria-pressed={mode === "poll"}
          onClick={() => showMode("poll")}
        >
          <Rows3 className="mr-2 h-4 w-4" />
          {zh ? "展示投票" : "Show poll"}
        </Button>
        {snapshot.poll.phase === "draft" && (
          <Button
            disabled={disabled}
            onClick={() =>
              void command(
                { action: "phase", pollId: snapshot.poll!.pollId, phase: "open" },
                (prev) => withPollPhase(prev, "open"),
              )
            }
          >
            {zh ? "開放作答" : "Open voting"}
          </Button>
        )}
        {snapshot.poll.phase === "open" && (
          <Button
            disabled={disabled}
            onClick={() =>
              void command(
                { action: "phase", pollId: snapshot.poll!.pollId, phase: "closed" },
                (prev) => withPollPhase(prev, "closed"),
              )
            }
          >
            {zh ? "結束收票" : "Close voting"}
          </Button>
        )}
        {snapshot.poll.phase === "closed" && (
          <Button
            disabled={disabled}
            onClick={() =>
              void command(
                { action: "phase", pollId: snapshot.poll!.pollId, phase: "results" },
                (prev) => withPollPhase(prev, "results"),
              )
            }
          >
            {zh ? "公布結果" : "Reveal results"}
          </Button>
        )}
        {["closed", "results"].includes(snapshot.poll.phase) && (
          <Button
            disabled={disabled}
            variant="outline"
            onClick={() =>
              void command(
                { action: "phase", pollId: snapshot.poll!.pollId, phase: "open" },
                (prev) => withPollPhase(prev, "open"),
              )
            }
          >
            {zh ? "重新收票（保留票數）" : "Reopen (keep votes)"}
          </Button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <section className="space-y-5" aria-label={zh ? "投影控制" : "Presentation controls"}>
      <div className="z-20 flex flex-wrap items-center gap-x-4 lg:sticky lg:top-0 gap-y-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mr-auto flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              connected ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" : "bg-amber-500",
            )}
          />
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold">
              {zh ? "目前投影：" : "On screen: "}
              {snapshot ? displayLabel(snapshot.mode, zh) : "…"}
            </p>
            <p role="status" className={cn("text-xs", connected ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
              {connected
                ? zh ? "投影已連線" : "Display connected"
                : zh ? "等待投影連線" : "Waiting for display"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={disabled}
            variant={mode === "deck" ? "secondary" : "outline"}
            aria-pressed={mode === "deck"}
            onClick={() => showMode("deck")}
          >
            <Presentation className="mr-2 h-4 w-4" />
            {zh ? "返回簡報" : "Back to slides"}
          </Button>
          <Button
            disabled={disabled}
            variant={mode === "blank" ? "secondary" : "outline"}
            aria-pressed={mode === "blank"}
            onClick={() => showMode(mode === "blank" ? "deck" : "blank")}
          >
            <Square className="mr-2 h-4 w-4" />
            {mode === "blank"
              ? zh ? "恢復簡報" : "Resume slides"
              : zh ? "暫時遮幕" : "Blank screen"}
          </Button>
          {displayOpen && onClose ? (
            <Button variant="secondary" onClick={onClose} title={t("live_dual_screen_hint")}>
              <MonitorOff className="mr-2 h-4 w-4" />
              {t("live_dual_screen_close")}
            </Button>
          ) : (
            <Button onClick={onOpen} title={t("live_dual_screen_hint")}>
              <MonitorPlay className="mr-2 h-4 w-4" />
              {t("live_dual_screen_present")}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="flex flex-wrap items-center gap-1 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {zh
            ? "同步或操作失敗，請重試；目前畫面可能尚未更新。"
            : "Could not synchronize. The display may be out of date."}
          <Button variant="link" className="h-auto p-0" onClick={retry}>
            {zh ? "重試" : "Retry"}
          </Button>
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          {stage}
          {renderPoll ? renderPoll(pollFlow) : pollFlow}
        </div>
        <aside aria-label={zh ? "投影與課堂參與" : "Display and participation"} className="min-w-0 space-y-6">
          {snapshot && (
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{zh ? "投影內容預覽" : "Projected content preview"}</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                      <Expand className="mr-1.5 h-3.5 w-3.5" />
                      {zh ? "放大預覽" : "Enlarge preview"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-6xl">
                    <DialogTitle>{zh ? "投影內容預覽" : "Projected content preview"}</DialogTitle>
                    <div
                      className="mx-auto overflow-hidden rounded-xl bg-slate-950 text-white"
                      style={{
                        aspectRatio: `${displayMetrics.width}/${displayMetrics.height}`,
                        width: `min(100%, ${(75 * displayMetrics.width) / displayMetrics.height}vh)`,
                      }}
                    >
                      {snapshot.mode === "deck" && snapshot.deckUrl ? (
                        <DeckViewer url={snapshot.deckUrl} page={previewPage} className="h-full w-full" />
                      ) : (
                        <PresentationContent snapshot={snapshot} preview />
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {preview}
              {connected &&
                ["question", "poll"].includes(snapshot.mode) &&
                (displayMetrics.up || displayMetrics.down) && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="mr-auto">{zh ? "捲動投影畫面" : "Scroll projected screen"}</span>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={!displayMetrics.up} onClick={() => scrollDisplay(-1)} aria-label={zh ? "投影往上捲動" : "Scroll display up"}>↑</Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={!displayMetrics.down} onClick={() => scrollDisplay(1)} aria-label={zh ? "投影往下捲動" : "Scroll display down"}>↓</Button>
                  </div>
                )}
            </div>
          )}
          {aside}
          <div className="rounded-2xl border bg-card">
            <div className="space-y-4 border-b p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  {t("live_qa_title")}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {zh ? `共 ${questions.length} 則` : `${questions.length} total`}
                </span>
              </div>
              <div className="grid gap-3 rounded-xl bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">{zh ? "每頁題數" : "Questions per page"}</span>
                  <SegmentedControl
                    label={zh ? "每頁題數" : "Questions per page"}
                    value={pageSize}
                    disabled={disabled}
                    options={[3, 4, 6].map((n) => ({ value: n, label: n }))}
                    onChange={(n) => void showOverview(0, n as 3 | 4 | 6)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">{zh ? "投影排序" : "Display order"}</span>
                  <SegmentedControl
                    label={zh ? "投影排序" : "Display order"}
                    value={sort}
                    disabled={disabled}
                    options={[
                      { value: "popular" as const, label: zh ? "最多讚" : "Top" },
                      { value: "newest" as const, label: zh ? "最新" : "Newest" },
                      { value: "oldest" as const, label: zh ? "最早" : "Oldest" },
                    ]}
                    onChange={(order) => void showOverview(0, pageSize, order)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                  <Button
                    size="sm"
                    disabled={disabled}
                    variant={mode === "questions" ? "secondary" : "default"}
                    aria-pressed={mode === "questions"}
                    onClick={() => void showOverview()}
                  >
                    {zh ? "投射問題總覽" : "Show overview"}
                  </Button>
                  <div className="flex items-center rounded-md border bg-background">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-r-none px-2"
                      disabled={disabled || offset === 0}
                      onClick={() => void showOverview(Math.max(0, offset - pageSize))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only sm:pr-1">{zh ? "上一組" : "Previous group"}</span>
                    </Button>
                    <span className="h-5 w-px bg-border" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-l-none px-2"
                      disabled={disabled || offset + pageSize >= total}
                      onClick={() => void showOverview(offset + pageSize)}
                    >
                      <span className="sr-only sm:not-sr-only sm:pl-1">{zh ? "下一組" : "Next group"}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground" role="status">
                    {zh ? `共 ${total} 題待回答` : `${total} pending`}
                    {snapshot?.mode === "questions" &&
                      snapshot.questions.length > 0 &&
                      (zh
                        ? ` · 本組 ${offset + 1}–${offset + snapshot.questions.length}`
                        : ` · Group ${offset + 1}–${offset + snapshot.questions.length}`)}
                  </span>
                  <Button
                    size="sm"
                    variant={newCount > 0 ? "outline" : "ghost"}
                    className={cn("h-8 px-2 text-xs", newCount > 0 && "border-primary/40 text-primary")}
                    disabled={disabled}
                    onClick={() => void showOverview(offset)}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    {newCount > 0
                      ? zh ? `${newCount} 個新問題・更新總覽` : `${newCount} new · Update overview`
                      : zh ? "更新總覽排序" : "Refresh overview"}
                  </Button>
                </div>
              </div>
              <SegmentedControl
                label={zh ? "問題分類" : "Question filter"}
                value={filter}
                onChange={setFilter}
                className="flex w-full [&>button]:flex-1"
                options={[
                  { value: "pending" as const, label: <>{zh ? "待回答" : "Pending"}<Count n={pendingQuestions.length} /></> , ariaLabel: zh ? "查看待回答" : "Pending" },
                  { value: "answered" as const, label: <>{zh ? "已回答" : "Answered"}<Count n={answeredQuestions.length} /></>, ariaLabel: zh ? "查看已回答" : "Answered" },
                  { value: "hidden" as const, label: <>{zh ? "已隱藏" : "Hidden"}<Count n={hiddenQuestions.length} /></>, ariaLabel: zh ? "查看已隱藏" : "Hidden" },
                ]}
              />
            </div>
            {listed.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {questions.length === 0
                  ? t("live_qa_panel_empty")
                  : filter === "pending"
                    ? zh ? "目前沒有待回答的公開問題。" : "No pending public questions."
                    : filter === "answered"
                      ? zh ? "還沒有標記為已回答的問題。" : "Nothing marked answered yet."
                      : zh ? "沒有隱藏的問題。" : "No hidden questions."}
              </p>
            ) : (
              <ul className="max-h-[560px] divide-y overflow-y-auto">
                {listed.map((q) => {
                  const featured = q.id === featuredId;
                  return (
                    <li key={q.id} className={cn("space-y-2.5 p-4", featured && "bg-primary/5")}>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{t(`live_qa_lens_${q.lens}` as const)}</span>
                        <span className="font-mono tabular-nums">▲ {q.upvotes}</span>
                        {featured && (
                          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                            {zh ? "投影中" : "On screen"}
                          </span>
                        )}
                      </div>
                      <p className="break-words text-sm leading-6">{q.text}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {filter === "pending" && !featured && (
                          <Button
                            size="sm"
                            className="h-8"
                            disabled={disabled}
                            onClick={() =>
                              void command({ action: "question", questionId: q.id }, (prev) => ({
                                ...prev,
                                mode: "question",
                                questions: [{ id: q.id, text: q.text, upvotes: q.upvotes, answered: false }],
                              }))
                            }
                          >
                            <Expand className="mr-1.5 h-3.5 w-3.5" />
                            {zh ? "放大這題" : "Feature"}
                          </Button>
                        )}
                        {filter === "pending" && featured && (
                          <Button
                            size="sm"
                            className="h-8"
                            disabled={disabled}
                            onClick={() =>
                              void command({ action: "answer", questionId: q.id, answered: true, advance: true })
                            }
                          >
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                            {zh ? "已回答並顯示下一題" : "Answer and show next"}
                          </Button>
                        )}
                        {filter !== "hidden" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={disabled}
                            onClick={() => {
                              const answered = filter === "pending";
                              void command({ action: "answer", questionId: q.id, answered }, (prev) => ({
                                ...prev,
                                answeredIds: answered
                                  ? [...prev.answeredIds, q.id]
                                  : prev.answeredIds.filter((id) => id !== q.id),
                              }));
                            }}
                          >
                            {filter === "answered" ? (
                              <><Undo2 className="mr-1.5 h-3.5 w-3.5" />{zh ? "恢復待回答" : "Mark pending"}</>
                            ) : (
                              <>{zh ? "標記已回答" : "Mark answered"}</>
                            )}
                          </Button>
                        )}
                        {onModerate && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-8 px-2 text-xs text-muted-foreground"
                            disabled={moderatingId === q.id}
                            onClick={() => onModerate(q)}
                          >
                            {q.visibility === "public" ? (
                              <><EyeOff className="mr-1.5 h-3.5 w-3.5" />{t("live_qa_moderate_hide")}</>
                            ) : (
                              <><Eye className="mr-1.5 h-3.5 w-3.5" />{t("live_qa_moderate_show")}</>
                            )}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-foreground/[0.07] px-1.5 text-[11px] tabular-nums">{n}</span>
  );
}
