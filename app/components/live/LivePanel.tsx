'use client';

import { useState, type FormEvent } from 'react';
import { BarChart3, Eye, EyeOff, MessageSquare, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import type { LivePollState, LiveQuestion } from '@/lib/live-session';

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
  onOpenPoll: (question: string, options: string[]) => Promise<boolean>;
}

/** Slido-style Q&A/poll panel, viewable and usable while still projecting -
 * the presenter no longer has to exit fullscreen to moderate a question,
 * check poll results, or start a new poll. */
export function LivePanel({
  open, onClose, poll, questions, moderatingId, onModerateQuestion, onOpenPoll,
}: Props) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [tab, setTab] = useState<'qa' | 'poll'>('qa');
  const [composing, setComposing] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [draftOptions, setDraftOptions] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);

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

  const submitPoll = async (event: FormEvent) => {
    event.preventDefault();
    const cleanOptions = draftOptions.map((option) => option.trim()).filter(Boolean);
    if (!draftQuestion.trim() || cleanOptions.length < 2 || submitting) return;
    setSubmitting(true);
    const ok = await onOpenPoll(draftQuestion.trim(), cleanOptions);
    setSubmitting(false);
    if (ok) {
      setComposing(false);
      setDraftQuestion('');
      setDraftOptions(['', '']);
    }
  };

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
            {composing ? (
              <form onSubmit={submitPoll} className="mt-5 space-y-3 border-t border-white/10 pt-4">
                <Textarea
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/40"
                  rows={2}
                  maxLength={500}
                  value={draftQuestion}
                  onChange={(event) => setDraftQuestion(event.target.value)}
                  placeholder={t('live_poll_question_label')}
                  required
                />
                {draftOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      className="border-white/20 bg-white/5 text-white placeholder:text-white/40"
                      value={option}
                      maxLength={120}
                      onChange={(event) =>
                        setDraftOptions((previous) =>
                          previous.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                        )
                      }
                      placeholder={`${t('live_poll_option_placeholder')} ${String.fromCharCode(65 + index)}`}
                    />
                    {draftOptions.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-white hover:bg-white/15 hover:text-white"
                        onClick={() => setDraftOptions((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                        aria-label={t('live_remove_option', { option: String.fromCharCode(65 + index) })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2">
                  {draftOptions.length < 6 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/15 hover:text-white"
                      onClick={() => setDraftOptions((previous) => [...previous, ''])}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {t('live_add_option')}
                    </Button>
                  ) : <span />}
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || !draftQuestion.trim() || draftOptions.filter((option) => option.trim()).length < 2}
                  >
                    {t('live_open_poll')}
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-5 w-full border-white/20 bg-transparent text-white hover:bg-white/15 hover:text-white"
                onClick={() => setComposing(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('live_new_poll')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
