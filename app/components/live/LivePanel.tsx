'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Eye, EyeOff, Loader2, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import type { LivePollState, LiveQuestion } from '@/lib/live-session';
import type { Quiz, QuizQuestion } from '@/lib/quiz';

function sortQuestions(a: LiveQuestion, b: LiveQuestion): number {
  return b.upvotes - a.upvotes || a.createdAt.localeCompare(b.createdAt);
}

interface Props {
  open: boolean;
  onClose: () => void;
  poll: LivePollState | null;
  questions: LiveQuestion[];
  moderatingId: string | null;
  onModerateQuestion: (item: LiveQuestion) => void;
  quizzes: Quiz[] | null;
  quizzesLoading: boolean;
  quizPickerError: string;
  onLoadQuizzes: () => void;
  onPickQuizQuestion: (question: QuizQuestion) => void;
}

/** Slido-style Q&A/poll panel, viewable and usable while still projecting -
 * the presenter no longer has to exit fullscreen to moderate a question,
 * check poll results, or launch the next poll. Launching a poll only ever
 * picks from an already-saved quiz question, never a free-text composer -
 * writing a brand-new question live, mid-lecture, isn't a real workflow;
 * that stays on the presenter's regular (non-fullscreen) page instead. */
export function LivePanel({
  open, onClose, poll, questions, moderatingId, onModerateQuestion,
  quizzes, quizzesLoading, quizPickerError, onLoadQuizzes, onPickQuizQuestion,
}: Props) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [tab, setTab] = useState<'qa' | 'poll'>('qa');

  useEffect(() => {
    if (open && tab === 'poll' && quizzes === null && !quizzesLoading) onLoadQuizzes();
  }, [open, tab, quizzes, quizzesLoading, onLoadQuizzes]);

  if (!open) return null;

  const sorted = [...questions].sort(sortQuestions);
  const tabButton = (value: 'qa' | 'poll', label: string, Icon: typeof MessageSquare) => (
    <button
      type="button"
      aria-pressed={tab === value}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === value ? 'bg-white text-black' : 'text-white/70 hover:text-white'}`}
      onClick={() => setTab(value)}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <div
      data-presentation-ui=""
      role="dialog"
      aria-label={t('live_panel_toggle')}
      className="absolute inset-x-4 top-24 bottom-24 z-[77] flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/95 text-white shadow-2xl backdrop-blur-md sm:inset-x-auto sm:right-4 sm:w-96"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 p-2.5">
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {tabButton('qa', t('live_qa_title'), MessageSquare)}
          {tabButton('poll', t('live_current_poll'), BarChart3)}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-white hover:bg-white/15 hover:text-white"
          aria-label={t('live_panel_close')}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'qa' ? (
          sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/60">{t('live_qa_panel_empty')}</p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start justify-between gap-2 rounded-lg border border-white/10 p-3 text-sm ${item.visibility === 'author_only' ? 'opacity-60' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-white/50">
                      <span>{t(`live_qa_lens_${item.lens}` as const)}</span>
                      <span className="font-mono">▲ {item.upvotes}</span>
                    </div>
                    <p className="break-words">{item.text}</p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 text-white hover:bg-white/15 hover:text-white"
                    disabled={moderatingId === item.id}
                    onClick={() => onModerateQuestion(item)}
                    aria-label={t(item.visibility === 'public' ? 'live_qa_moderate_hide' : 'live_qa_moderate_show')}
                  >
                    {item.visibility === 'public' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div>
            {poll ? (
              <>
                <p className="mb-4 break-words text-lg font-semibold leading-snug">{poll.question}</p>
                <div className="space-y-3">
                  {poll.options.map((option, index) => {
                    const count = poll.voteCounts[index] ?? 0;
                    const pct = poll.voteTotal > 0 ? Math.round((count / poll.voteTotal) * 100) : 0;
                    return (
                      <div key={index}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 flex-1 break-words">{option}</span>
                          <span className="shrink-0 font-mono tabular-nums text-white/70">{pct}% ({count})</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-white/50">{poll.voteTotal} {t('live_answered')}</p>
              </>
            ) : (
              <p className="py-6 text-sm text-white/60">{t('live_no_active_poll')}</p>
            )}
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-medium text-white/60">{t('live_load_from_quiz_pick_question')}</p>
              {quizzesLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-white/60" />
                </div>
              ) : quizPickerError ? (
                <p role="alert" className="py-4 text-center text-sm text-rose-300">{quizPickerError}</p>
              ) : !quizzes || quizzes.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/50">{t('live_load_from_quiz_empty')}</p>
              ) : (
                <div className="max-h-64 space-y-3 overflow-y-auto">
                  {quizzes.map((quiz) => (
                    <div key={quiz.id}>
                      <p className="mb-1 truncate text-xs font-semibold text-white/70">{quiz.title}</p>
                      <div className="space-y-1">
                        {quiz.questions.map((quizQuestion, index) => (
                          <button
                            key={quizQuestion.id}
                            type="button"
                            onClick={() => onPickQuizQuestion(quizQuestion)}
                            className="block w-full whitespace-normal break-words rounded-lg border border-white/10 px-3 py-2 text-left text-sm hover:border-white/30 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                          >
                            {index + 1}. {quizQuestion.questionText}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
