"use client";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  BarChart3,
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
  Settings2,
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
type WorkspaceTab = "deck" | "poll" | "qa" | "display";

// The presenter workspace's layout owner: a sticky bar with the session
// controls on top, then one tab at a time - slides, poll, or the single Q&A
// panel (moderation + projection) - beside the projection card (what is on
// screen, its preview, back-to-slides / blank) and the pulse. On narrow
// screens the tabs move to a bottom bar and the projection column becomes a
// fourth tab, so the teacher sees one screenful at a time.
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
  header,
  pollVotes = null,
  notice,
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
  /** Session identity and controls, shown at the start of the sticky top bar. */
  header?: ReactNode;
  /** Votes on the current poll, shown on the poll tab. */
  pollVotes?: number | null;
  /** A session-state message shown under the top bar (paused, ended). */
  notice?: ReactNode;
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
  const [tab, setTab] = useState<WorkspaceTab>("deck");
  // From lg up the projection column sits beside the tabs, so "display" is
  // not a tab there; a phone left on it falls back to slides when widened.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const current: WorkspaceTab = wide && tab === "display" ? "deck" : tab;
  const [showOverviewSettings, setShowOverviewSettings] = useState(false);
  const disabled = pending || !snapshot || snapshot.status === "closed";
  // Switching what is on screen never waits on a previous command: the
  // latest click shows at once and is sent next (see usePresentationSnapshot).
  const modeDisabled = !snapshot || snapshot.status === "closed";
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
          disabled={modeDisabled}
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

  const tabs: { value: WorkspaceTab; label: string; icon: typeof Presentation; badge?: number | null; desktop?: false }[] = [
    { value: "deck", label: zh ? "投影片" : "Slides", icon: Presentation },
    { value: "poll", label: zh ? "投票" : "Poll", icon: BarChart3, badge: pollVotes },
    { value: "qa", label: zh ? "問答" : "Q&A", icon: MessageSquare, badge: pendingQuestions.length || null },
    { value: "display", label: zh ? "投影" : "Display", icon: MonitorPlay, desktop: false },
  ];
  const tabId = (value: WorkspaceTab) => `workspace-tab-${value}`;
  const panelId = (value: WorkspaceTab) => `workspace-panel-${value}`;
  const visibleTabs = wide ? tabs.filter((item) => item.desktop !== false) : tabs;
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = visibleTabs.findIndex((item) => item.value === current);
    const next = visibleTabs[(index + step + visibleTabs.length) % visibleTabs.length].value;
    setTab(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <section className="space-y-5 pb-20 lg:pb-0" aria-label={zh ? "投影控制" : "Presentation controls"}>
      <div className="z-20 flex flex-wrap items-center lg:sticky lg:top-0 gap-x-3 gap-y-2 rounded-2xl border bg-card/95 px-3 py-2.5 shadow-sm backdrop-blur sm:px-4">
        {header}
        {displayOpen && onClose ? (
          <Button variant="secondary" className="hidden h-10 sm:inline-flex" onClick={onClose} title={t("live_dual_screen_hint")}>
            <MonitorOff className="h-4 w-4 sm:mr-2" />
            <span className="sr-only sm:not-sr-only">{t("live_dual_screen_close")}</span>
          </Button>
        ) : (
          <Button className="hidden h-10 sm:inline-flex" onClick={onOpen} title={t("live_dual_screen_hint")}>
            <MonitorPlay className="h-4 w-4 sm:mr-2" />
            <span className="sr-only sm:not-sr-only">{t("live_dual_screen_present")}</span>
          </Button>
        )}
      </div>
      {notice}
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
        {/* Only the panels hide: the tab bar inside must stay reachable. */}
        <div className="min-w-0 lg:space-y-4">
          <div
            role="tablist"
            aria-label={zh ? "教學工作區" : "Workspace"}
            className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:static lg:inline-flex lg:rounded-xl lg:border lg:bg-muted/60 lg:p-1"
          >
            {tabs.map((item) => {
              const Icon = item.icon;
              const selected = current === item.value;
              return (
                <button
                  key={item.value}
                  id={tabId(item.value)}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId(item.value)}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTab(item.value)}
                  onKeyDown={onTabKeyDown}
                  className={cn(
                    "relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9 lg:flex-none lg:flex-row lg:gap-2 lg:text-sm",
                    item.desktop === false && "lg:hidden",
                    selected
                      ? "text-foreground lg:bg-background lg:shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5 lg:h-4 lg:w-4", selected && "text-primary lg:text-foreground")} />
                  {item.label}
                  {item.badge != null && (
                    <span
                      className={cn(
                        "absolute right-[calc(50%-1.6rem)] top-1 rounded-full px-1.5 text-[10px] tabular-nums lg:static lg:text-[11px]",
                        item.value === "qa" ? "bg-primary text-primary-foreground" : "bg-foreground/[0.08]",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div role="tabpanel" id={panelId("deck")} aria-labelledby={tabId("deck")} className={cn(current !== "deck" && "hidden")}>
            {stage}
          </div>
          <div role="tabpanel" id={panelId("poll")} aria-labelledby={tabId("poll")} className={cn(current !== "poll" && "hidden")}>
            {renderPoll ? renderPoll(pollFlow) : pollFlow}
          </div>
          <div role="tabpanel" id={panelId("qa")} aria-labelledby={tabId("qa")} className={cn(current !== "qa" && "hidden")}>
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
                <div className="flex flex-wrap items-center gap-2">
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
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-8 px-2 text-xs text-muted-foreground"
                    aria-expanded={showOverviewSettings}
                    onClick={() => setShowOverviewSettings((value) => !value)}
                  >
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    {zh ? "投影設定" : "Display settings"}
                  </Button>
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
                {showOverviewSettings && (
                  <div className="grid gap-3 border-t border-border/70 pt-3">
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
                  </div>
                )}
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
          </div>
        </div>
        <aside
          id={panelId("display")}
          aria-label={zh ? "投影與課堂參與" : "Display and participation"}
          className={cn("min-w-0 space-y-6", current !== "display" && "hidden lg:block")}
        >
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0 leading-tight">
                <h2 className="text-sm font-semibold">
                  {zh ? "目前投影：" : "On screen: "}
                  {snapshot ? displayLabel(snapshot.mode, zh) : "…"}
                </h2>
                <p role="status" className={cn("mt-1 flex items-center gap-1.5 text-xs", connected ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                  <span
                    aria-hidden="true"
                    className={cn("h-2 w-2 shrink-0 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")}
                  />
                  {connected
                    ? zh ? "投影已連線" : "Display connected"
                    : zh ? "等待投影連線" : "Waiting for display"}
                </p>
              </div>
              {snapshot && (
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
              )}
            </div>
            {snapshot ? preview : <div className="aspect-video rounded-lg bg-slate-950/90" />}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                disabled={modeDisabled}
                variant={mode === "deck" ? "secondary" : "outline"}
                aria-pressed={mode === "deck"}
                onClick={() => showMode("deck")}
              >
                <Presentation className="mr-2 h-4 w-4" />
                {zh ? "返回簡報" : "Back to slides"}
              </Button>
              <Button
                disabled={modeDisabled}
                variant={mode === "blank" ? "secondary" : "outline"}
                aria-pressed={mode === "blank"}
                onClick={() => showMode(mode === "blank" ? "deck" : "blank")}
              >
                <Square className={cn("mr-2 h-4 w-4", mode === "blank" && "fill-current")} />
                {zh ? "暫時遮幕" : "Blank screen"}
              </Button>
            </div>
            {snapshot && connected &&
                ["question", "poll"].includes(snapshot.mode) &&
                (displayMetrics.up || displayMetrics.down) && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="mr-auto">{zh ? "捲動投影畫面" : "Scroll projected screen"}</span>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={!displayMetrics.up} onClick={() => scrollDisplay(-1)} aria-label={zh ? "投影往上捲動" : "Scroll display up"}>↑</Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={!displayMetrics.down} onClick={() => scrollDisplay(1)} aria-label={zh ? "投影往下捲動" : "Scroll display down"}>↓</Button>
                  </div>
                )}
          </div>
          {aside}
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
