import { BarChart3, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import type { LivePollState } from '@/lib/live-session';

export type Spotlight =
  | { type: 'poll'; poll: LivePollState }
  | { type: 'questions'; questions: { id: string; text: string; upvotes: number }[] };

/** The presenter's explicit "reveal" moment on the projected display window -
 * shown only when spotlight:show is broadcast, never automatically. Only
 * ever renders content that was already public (a live poll's own results,
 * or questions the presenter already approved for the class to see) -
 * never the moderation queue or hidden questions. */
export function SpotlightOverlay({ spotlight }: { spotlight: Spotlight }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const zh = language === 'zh-TW';

  return (
    <div
      role="region"
      aria-label={t(spotlight.type === 'poll' ? 'live_spotlight_poll' : 'live_spotlight_questions')}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-zinc-950/95 p-6 text-white shadow-2xl sm:p-8">
        {spotlight.type === 'poll' ? (
          <>
            <p className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/50">
              <BarChart3 className="h-3.5 w-3.5" />
              {t('live_current_poll')}
            </p>
            <p className="mb-6 break-words text-2xl font-semibold leading-snug sm:text-3xl">{spotlight.poll.question}</p>
            <div className="space-y-4">
              {spotlight.poll.options.map((option, index) => {
                const count = spotlight.poll.voteCounts[index] ?? 0;
                const pct = spotlight.poll.voteTotal > 0 ? Math.round((count / spotlight.poll.voteTotal) * 100) : 0;
                return (
                  <div key={index}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm sm:text-base">
                      <span className="min-w-0 flex-1 break-words">{option}</span>
                      <span className="shrink-0 font-mono tabular-nums text-white/70">{pct}% ({count})</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-white transition-[width] motion-reduce:transition-none"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 text-sm text-white/50">{spotlight.poll.voteTotal} {t('live_answered')}</p>
          </>
        ) : (
          <>
            <p className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/50">
              <MessageSquare className="h-3.5 w-3.5" />
              {t('live_qa_title')}
            </p>
            {spotlight.questions.length === 0 ? (
              <p className="py-6 text-center text-white/60">{t('live_qa_panel_empty')}</p>
            ) : (
              <ul className="space-y-3">
                {spotlight.questions.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="min-w-0 break-words text-lg leading-relaxed sm:text-xl">{item.text}</p>
                    <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 font-mono text-sm text-white/80">
                      ▲ {item.upvotes}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <p className="mt-2 sr-only">{zh ? '揭曉畫面，隨時可能更新。' : 'Live reveal - may update at any time.'}</p>
      </div>
    </div>
  );
}
