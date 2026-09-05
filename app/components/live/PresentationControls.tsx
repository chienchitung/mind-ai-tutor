"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/app/contexts/LanguageContext";
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
export function PresentationControls({
  sessionId,
  questions,
  connected,
  onOpen,
}: {
  sessionId: string;
  questions: LiveQuestion[];
  connected: boolean;
  onOpen: () => void;
}) {
  const { language } = useLanguage();
  const zh = language === "zh-TW";
  const { snapshot, error, pending, command, retry } = usePresentationSnapshot(
    `/api/live-sessions/${sessionId}/presentation`,
    sessionId,
  );
  const offset = snapshot?.overview?.offset ?? 0;
  const pageSize = snapshot?.overview?.pageSize ?? 4;
  const sort = snapshot?.overview?.sort ?? "popular";
  const total = snapshot?.overview?.total ?? 0;
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
  const [showAnswered, setShowAnswered] = useState(false);
  const disabled = pending || !snapshot || snapshot.status === "closed";
  const candidates = questions.filter(
    (q) =>
      q.visibility === "public" &&
      (snapshot?.answeredIds.includes(q.id) ?? false) === showAnswered,
  );
  const scrollDisplay = (direction: number) => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`live-ink:${sessionId}`);
    channel.postMessage({ type: "scroll", direction });
    channel.close();
  };
  return (
    <section
      className="contents"
      aria-label={zh ? "投影控制" : "Presentation controls"}
    >
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-4 shadow-sm backdrop-blur">
        <strong className="mr-auto">
          {zh ? "目前投影：" : "On screen: "}
          {snapshot ? displayLabel(snapshot.mode, zh) : "…"}
        </strong>
        <span
          role="status"
          className={`text-xs ${connected ? "text-teal-700" : "text-amber-700"}`}
        >
          {connected
            ? zh
              ? "投影已連線"
              : "Display connected"
            : zh
              ? "等待投影連線"
              : "Waiting for display"}
        </span>
        <Button variant="outline" onClick={onOpen}>
          {zh ? "開啟投影" : "Open display"}
        </Button>
        <Button
          disabled={disabled}
          variant="outline"
          onClick={() =>
            void command({ action: "show", mode: "deck" }, (prev) => ({
              ...prev,
              mode: "deck",
            }))
          }
        >
          {zh ? "返回簡報" : "Back to slides"}
        </Button>
        <Button
          disabled={disabled}
          variant={snapshot?.mode === "blank" ? "secondary" : "outline"}
          onClick={() => {
            const nextMode = snapshot?.mode === "blank" ? "deck" : "blank";
            void command({ action: "show", mode: nextMode }, (prev) => ({
              ...prev,
              mode: nextMode,
            }));
          }}
        >
          {snapshot?.mode === "blank"
            ? zh
              ? "恢復簡報"
              : "Resume slides"
            : zh
              ? "暫時遮幕"
              : "Blank screen"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="py-2 text-sm text-destructive">
          {zh
            ? "同步或操作失敗，請重試；目前畫面可能尚未更新。"
            : "Could not synchronize. The display may be out of date."}
          <Button variant="link" onClick={retry}>
            {zh ? "重試" : "Retry"}
          </Button>
        </p>
      )}
      <div className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-5 lg:grid-cols-2">
        <div className="space-y-4">
          {snapshot?.poll && (
            <div className="space-y-3 rounded-xl border p-4">
              <h2 className="font-semibold">
                {zh ? "投票流程" : "Poll flow"} ·{" "}
                {phaseLabel(snapshot.poll.phase, zh)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {zh
                  ? "先展示題目，收票結束後再公布比例；不會暫停學生提問。"
                  : "Show the question first, then reveal results after voting. Q&A stays open."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={disabled}
                  variant="outline"
                  onClick={() =>
                    void command({ action: "show", mode: "poll" }, (prev) => ({
                      ...prev,
                      mode: "poll",
                    }))
                  }
                >
                  {zh ? "展示投票" : "Show poll"}
                </Button>
                {snapshot.poll.phase === "draft" && (
                  <Button
                    disabled={disabled}
                    onClick={() =>
                      void command(
                        {
                          action: "phase",
                          pollId: snapshot.poll!.pollId,
                          phase: "open",
                        },
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
                        {
                          action: "phase",
                          pollId: snapshot.poll!.pollId,
                          phase: "closed",
                        },
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
                        {
                          action: "phase",
                          pollId: snapshot.poll!.pollId,
                          phase: "results",
                        },
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
                        {
                          action: "phase",
                          pollId: snapshot.poll!.pollId,
                          phase: "open",
                        },
                        (prev) => withPollPhase(prev, "open"),
                      )
                    }
                  >
                    {zh ? "重新收票（保留票數）" : "Reopen (keep votes)"}
                  </Button>
                )}
              </div>
            </div>
          )}
          <details open className="rounded-xl border p-4">
            <summary className="cursor-pointer font-semibold">
              {zh
                ? "問答控場：指定問題、標記已回答"
                : "Q&A: feature or mark answered"}
            </summary>
            <p className="my-3 text-sm text-muted-foreground">
              {zh
                ? "只有公開問題可以投射；投射不會改變問題的公開設定。可調整每頁題數與排序；新提問或按讚不會使投影跳動。長題目在總覽顯示摘要，按「放大這題」閱讀全文。"
                : "Only public questions can be projected. Visibility stays unchanged. Choose the display density and order. Questions stay in place until you update them."}
            </p>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">
                {zh ? "每頁題數" : "Questions per page"}
                <select
                  className="rounded-md border bg-background p-2"
                  disabled={disabled}
                  value={pageSize}
                  onChange={(e) =>
                    void showOverview(0, Number(e.target.value) as 3 | 4 | 6)
                  }
                >
                  {[3, 4, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                {zh ? "投影排序" : "Display order"}
                <select
                  className="rounded-md border bg-background p-2"
                  disabled={disabled}
                  value={sort}
                  onChange={(e) =>
                    void showOverview(
                      0,
                      pageSize,
                      e.target.value as typeof sort,
                    )
                  }
                >
                  <option value="popular">
                    {zh ? "最多讚" : "Most votes"}
                  </option>
                  <option value="newest">{zh ? "最新" : "Newest"}</option>
                  <option value="oldest">{zh ? "最早" : "Oldest"}</option>
                </select>
              </label>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                disabled={disabled}
                variant="outline"
                onClick={() => void showOverview()}
              >
                {zh ? "投射問題總覽" : "Show overview"}
              </Button>
              <Button
                disabled={disabled || offset === 0}
                variant="outline"
                onClick={() =>
                  void showOverview(Math.max(0, offset - pageSize))
                }
              >
                {zh ? "上一組" : "Previous group"}
              </Button>
              <Button
                disabled={disabled || offset + pageSize >= total}
                variant="outline"
                onClick={() => void showOverview(offset + pageSize)}
              >
                {zh ? "下一組" : "Next group"}
              </Button>
              <span className="text-sm text-muted-foreground" role="status">
                {zh ? `共 ${total} 題待回答` : `${total} pending`}
                {snapshot?.mode === "questions" &&
                  snapshot.questions.length > 0 &&
                  (zh
                    ? ` · 本組 ${offset + 1}–${offset + snapshot.questions.length}`
                    : ` · Group ${offset + 1}–${offset + snapshot.questions.length}`)}
              </span>
              <Button
                disabled={disabled}
                variant="outline"
                onClick={() => void showOverview(offset)}
              >
                {(snapshot?.overview?.newCount ?? 0) > 0
                  ? zh
                    ? `${snapshot!.overview!.newCount} 個新問題・更新總覽`
                    : `${snapshot!.overview!.newCount} new · Update overview`
                  : zh
                    ? "更新總覽排序"
                    : "Refresh overview"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowAnswered(!showAnswered)}
              >
                {showAnswered
                  ? zh
                    ? "查看待回答"
                    : "Pending"
                  : zh
                    ? "查看已回答"
                    : "Answered"}
              </Button>
            </div>
            <ul className="max-h-80 space-y-3 overflow-y-auto">
              {candidates.map((q) => (
                <li key={q.id} className="space-y-2 rounded-lg bg-muted/40 p-3">
                  <p className="break-words text-sm">{q.text}</p>
                  <div className="flex flex-wrap gap-2">
                    {!showAnswered && (
                      <Button
                        size="sm"
                        disabled={disabled}
                        onClick={() =>
                          void command(
                            { action: "question", questionId: q.id },
                            (prev) => ({
                              ...prev,
                              mode: "question",
                              questions: [
                                { id: q.id, text: q.text, upvotes: q.upvotes, answered: false },
                              ],
                            }),
                          )
                        }
                      >
                        {zh ? "放大這題" : "Feature"}
                      </Button>
                    )}
                    {!showAnswered &&
                      snapshot?.mode === "question" &&
                      snapshot.questions[0]?.id === q.id && (
                        <Button
                          size="sm"
                          disabled={disabled}
                          onClick={() =>
                            void command({
                              action: "answer",
                              questionId: q.id,
                              answered: true,
                              advance: true,
                            })
                          }
                        >
                          {zh ? "已回答並顯示下一題" : "Answer and show next"}
                        </Button>
                      )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => {
                        const answered = !showAnswered;
                        void command(
                          { action: "answer", questionId: q.id, answered },
                          (prev) => ({
                            ...prev,
                            answeredIds: answered
                              ? [...prev.answeredIds, q.id]
                              : prev.answeredIds.filter((id) => id !== q.id),
                          }),
                        );
                      }}
                    >
                      {showAnswered
                        ? zh
                          ? "恢復待回答"
                          : "Mark pending"
                        : zh
                          ? "標記已回答"
                          : "Mark answered"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </div>
        {snapshot && (
          <details open className="min-w-0 rounded-xl border p-3">
            <summary className="mb-2 cursor-pointer text-sm font-medium">
              {zh ? "投影內容預覽" : "Projected content preview"}
            </summary>
            {connected &&
              ["question", "poll"].includes(snapshot.mode) &&
              (displayMetrics.up || displayMetrics.down) && (
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span>{zh ? "捲動投影畫面" : "Scroll projected screen"}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!displayMetrics.up}
                    onClick={() => scrollDisplay(-1)}
                    aria-label={zh ? "投影往上捲動" : "Scroll display up"}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!displayMetrics.down}
                    onClick={() => scrollDisplay(1)}
                    aria-label={zh ? "投影往下捲動" : "Scroll display down"}
                  >
                    ↓
                  </Button>
                </div>
              )}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="mb-2">
                  {zh ? "放大預覽" : "Enlarge preview"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl">
                <DialogTitle>
                  {zh ? "投影內容預覽" : "Projected content preview"}
                </DialogTitle>
                <div
                  className="mx-auto overflow-hidden rounded-xl bg-slate-950 text-white"
                  style={{
                    aspectRatio: `${displayMetrics.width}/${displayMetrics.height}`,
                    width: `min(100%, ${(75 * displayMetrics.width) / displayMetrics.height}vh)`,
                  }}
                >
                  {snapshot.mode === "deck" && snapshot.deckUrl ? (
                    <DeckViewer
                      url={snapshot.deckUrl}
                      page={snapshot.deckPage}
                      className="h-full w-full"
                    />
                  ) : (
                    <PresentationContent snapshot={snapshot} preview />
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <div
              className="overflow-hidden rounded-xl bg-slate-950 text-white"
              style={{
                aspectRatio: `${displayMetrics.width}/${displayMetrics.height}`,
              }}
            >
              {snapshot.mode === "deck" && snapshot.deckUrl ? (
                <DeckViewer
                  url={snapshot.deckUrl}
                  page={snapshot.deckPage}
                  className="h-full w-full"
                />
              ) : snapshot.mode === "deck" ? (
                <p className="flex h-full items-center justify-center">
                  {zh
                    ? `尚未上傳簡報，可先投射投票或問題`
                    : `No slides yet. You can still show polls or questions.`}
                </p>
              ) : (
                <PresentationContent snapshot={snapshot} preview />
              )}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
