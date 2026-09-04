"use client";
import type { PresentationSnapshot } from "@/lib/live-presentation";
import { phaseLabel } from "@/lib/live-presentation";
import { useLanguage } from "@/app/contexts/LanguageContext";

/** Shared between the actual display and the teacher's content preview. */
export function PresentationContent({
  snapshot,
}: {
  snapshot: PresentationSnapshot;
  preview?: boolean;
}) {
  const { language } = useLanguage();
  const zh = language === "zh-TW";
  const poll = snapshot.poll;
  if (snapshot.status === "closed")
    return (
      <div className="flex h-full items-center justify-center text-3xl">
        {zh ? "本場次已結束，謝謝參與" : "Session ended. Thank you!"}
      </div>
    );
  if (snapshot.mode === "blank")
    return (
      <div
        className="h-full bg-black"
        aria-label={zh ? "暫時遮幕" : "Blank screen"}
      />
    );
  if (snapshot.mode === "deck") return null;
  return (
    <div className="h-full w-full" style={{ containerType: "size" }}>
      <section
        aria-label={zh ? "目前投影內容" : "Projected content"}
        data-projection-scroll
        className="flex h-full min-h-0 flex-col overflow-y-auto bg-slate-950 px-[6cqw] py-[4cqh] text-[2cqh] leading-normal text-white"
      >
        <div
          className={`flex flex-col gap-[2cqh] ${snapshot.mode === "questions" ? "h-full min-h-0" : "my-auto shrink-0"}`}
        >
          {snapshot.mode === "poll" && poll ? (
            <>
              <p className="text-teal-300">{phaseLabel(poll.phase, zh)}</p>
              <h2
                className={`break-words font-semibold leading-tight text-[4.5cqh]`}
              >
                {poll.question}
              </h2>
              <div className="grid gap-[1.5cqh]">
                {poll.options.map((option, index) => {
                  const count = poll.voteCounts[index] ?? 0;
                  const pct = poll.voteTotal
                    ? Math.round((count / poll.voteTotal) * 100)
                    : 0;
                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-white/15 bg-white/5 p-[1.5cqh]"
                    >
                      <div
                        className={`flex items-start gap-[2cqw] text-[3cqh]`}
                      >
                        <span className="font-mono text-teal-300">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="min-w-0 flex-1 break-words">
                          {option}
                        </span>
                        {poll.phase === "results" && (
                          <span className="shrink-0 tabular-nums">
                            {pct}% ({count})
                          </span>
                        )}
                      </div>
                      {poll.phase === "results" && (
                        <div className="mt-[1cqh] h-[1cqh] overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full bg-teal-400 transition-[width] motion-reduce:transition-none"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-teal-100">
                {zh
                  ? `已收到 ${poll.voteTotal} 份回答`
                  : `${poll.voteTotal} responses received`}
              </p>
            </>
          ) : (
            <>
              <p className="text-teal-300">
                {snapshot.mode === "question"
                  ? zh
                    ? "一起討論這個問題"
                    : "Let’s discuss this question"
                  : zh
                    ? "問題總覽"
                    : "Questions"}
              </p>
              {snapshot.questions.length === 0 ? (
                <p>
                  {zh
                    ? "目前沒有待討論的公開問題"
                    : "No public questions to discuss"}
                </p>
              ) : (
                <div
                  className={
                    snapshot.mode === "questions"
                      ? "grid min-h-0 flex-1 gap-[1.5cqh]"
                      : "grid gap-[2cqh]"
                  }
                  style={
                    snapshot.mode === "questions"
                      ? {
                          gridTemplateRows: `repeat(${snapshot.questions.length}, minmax(0, 1fr))`,
                        }
                      : undefined
                  }
                >
                  {snapshot.questions.map((q) => (
                    <article
                      key={q.id}
                      className="flex min-h-0 flex-col justify-center rounded-xl border border-white/15 bg-white/5 px-[2cqw] py-[1cqh]"
                    >
                      <p
                        className={`whitespace-pre-wrap break-words leading-snug ${snapshot.mode === "question" ? "text-[5cqh]" : snapshot.questions.length > 4 ? "line-clamp-2 text-[2.8cqh]" : "line-clamp-3 text-[3.4cqh]"}`}
                      >
                        {q.text}
                      </p>
                      <p className="mt-[0.5cqh] shrink-0 text-[2cqh] text-teal-300">
                        ▲ {q.upvotes}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
