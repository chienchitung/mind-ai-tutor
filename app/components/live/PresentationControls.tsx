"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { displayLabel, phaseLabel } from "@/lib/live-presentation";
import { usePresentationSnapshot } from "./usePresentationSnapshot";
import { DeckViewer } from "./DeckViewer";
import { PresentationContent } from "./PresentationContent";
import type { LiveQuestion } from "@/lib/live-session";
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
  const [offset, setOffset] = useState(0);
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
          onClick={() => void command({ action: "show", mode: "deck" })}
        >
          {zh ? "返回簡報" : "Back to slides"}
        </Button>
        <Button
          disabled={disabled}
          variant={snapshot?.mode === "blank" ? "secondary" : "outline"}
          onClick={() =>
            void command({
              action: "show",
              mode: snapshot?.mode === "blank" ? "deck" : "blank",
            })
          }
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
                  onClick={() => void command({ action: "show", mode: "poll" })}
                >
                  {zh ? "展示投票" : "Show poll"}
                </Button>
                {snapshot.poll.phase === "draft" && (
                  <Button
                    disabled={disabled}
                    onClick={() =>
                      void command({
                        action: "phase",
                        pollId: snapshot.poll!.pollId,
                        phase: "open",
                      })
                    }
                  >
                    {zh ? "開放作答" : "Open voting"}
                  </Button>
                )}
                {snapshot.poll.phase === "open" && (
                  <Button
                    disabled={disabled}
                    onClick={() =>
                      void command({
                        action: "phase",
                        pollId: snapshot.poll!.pollId,
                        phase: "closed",
                      })
                    }
                  >
                    {zh ? "結束收票" : "Close voting"}
                  </Button>
                )}
                {snapshot.poll.phase === "closed" && (
                  <Button
                    disabled={disabled}
                    onClick={() =>
                      void command({
                        action: "phase",
                        pollId: snapshot.poll!.pollId,
                        phase: "results",
                      })
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
                      void command({
                        action: "phase",
                        pollId: snapshot.poll!.pollId,
                        phase: "open",
                      })
                    }
                  >
                    {zh ? "重新收票（保留票數）" : "Reopen (keep votes)"}
                  </Button>
                )}
              </div>
            </div>
          )}
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-semibold">
              {zh
                ? "問答控場：指定問題、標記已回答"
                : "Q&A: feature or mark answered"}
            </summary>
            <p className="my-3 text-sm text-muted-foreground">
              {zh
                ? "只有公開問題可以投射；投射不會改變問題的公開設定。總覽每頁最多三題，順序在換頁時更新。"
                : "Only public questions can be projected. Visibility stays unchanged. Overview shows three questions per page."}
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                disabled={disabled}
                variant="outline"
                onClick={() => {
                  setOffset(0);
                  void command({
                    action: "show",
                    mode: "questions",
                    offset: 0,
                  });
                }}
              >
                {zh ? "投射問題總覽" : "Show overview"}
              </Button>
              <Button
                disabled={disabled || offset === 0}
                variant="outline"
                onClick={() => {
                  const next = Math.max(0, offset - 3);
                  setOffset(next);
                  void command({
                    action: "show",
                    mode: "questions",
                    offset: next,
                  });
                }}
              >
                {zh ? "上一頁" : "Previous"}
              </Button>
              <Button
                disabled={
                  disabled ||
                  offset + 3 >=
                    questions.filter(
                      (q) =>
                        q.visibility === "public" &&
                        !snapshot?.answeredIds.includes(q.id),
                    ).length
                }
                variant="outline"
                onClick={() => {
                  const next = offset + 3;
                  setOffset(next);
                  void command({
                    action: "show",
                    mode: "questions",
                    offset: next,
                  });
                }}
              >
                {zh ? "下一頁" : "Next"}
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
                  <div className="flex gap-2">
                    {!showAnswered && (
                      <Button
                        size="sm"
                        disabled={disabled}
                        onClick={() =>
                          void command({ action: "question", questionId: q.id })
                        }
                      >
                        {zh ? "投射這題" : "Feature"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() =>
                        void command({
                          action: "answer",
                          questionId: q.id,
                          answered: !showAnswered,
                        })
                      }
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
            <div className="mb-2 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!connected}
                onClick={() => scrollDisplay(-1)}
              >
                {zh ? "投影內容往上" : "Scroll display up"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!connected}
                onClick={() => scrollDisplay(1)}
              >
                {zh ? "投影內容往下" : "Scroll display down"}
              </Button>
            </div>
            <div className="h-72 overflow-hidden rounded-xl bg-slate-950 text-white">
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
