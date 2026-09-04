"use client";
import type { PresentationSnapshot } from "@/lib/live-presentation";
import { phaseLabel } from "@/lib/live-presentation";
import { useLanguage } from "@/app/contexts/LanguageContext";

/** Shared between the actual display and the teacher's content preview. */
export function PresentationContent({
  snapshot,
  preview = false,
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
    <section
      aria-label={zh ? "目前投影內容" : "Projected content"}
      data-projection-scroll
      className={`flex h-full min-h-0 flex-col overflow-y-auto bg-slate-950 text-white ${preview ? "gap-3 p-5" : "gap-[2vh] px-[6vw] py-[5vh]"}`}
    >
      <div className="my-auto flex shrink-0 flex-col gap-[2vh]">
        {snapshot.mode === "poll" && poll ? (
          <>
            <p className="text-teal-300">{phaseLabel(poll.phase, zh)}</p>
            <h2
              className={`break-words font-semibold leading-tight ${preview ? "text-xl" : "text-[clamp(1.75rem,3.4vw,4rem)]"}`}
            >
              {poll.question}
            </h2>
            <div className="grid gap-[1.5vh]">
              {poll.options.map((option, index) => {
                const count = poll.voteCounts[index] ?? 0;
                const pct = poll.voteTotal
                  ? Math.round((count / poll.voteTotal) * 100)
                  : 0;
                return (
                  <div
                    key={index}
                    className="rounded-xl border border-white/15 bg-white/5 p-[1.5vh]"
                  >
                    <div
                      className={`flex items-start gap-4 ${preview ? "text-sm" : "text-[clamp(1.125rem,2.1vw,2.5rem)]"}`}
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
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
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
              snapshot.questions.map((q) => (
                <article
                  key={q.id}
                  className="rounded-2xl border border-white/15 bg-white/5 p-[3vh]"
                >
                  <p
                    className={`whitespace-pre-wrap break-words leading-relaxed ${preview ? "text-lg" : snapshot.mode === "question" ? "text-[clamp(2rem,4vw,5rem)]" : "text-[clamp(1.5rem,2.8vw,3.5rem)]"}`}
                  >
                    {q.text}
                  </p>
                  <p className="mt-3 text-teal-300">▲ {q.upvotes}</p>
                </article>
              ))
            )}
          </>
        )}
      </div>
    </section>
  );
}
