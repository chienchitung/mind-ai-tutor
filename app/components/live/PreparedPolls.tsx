'use client';

import { Check, Loader2, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { MAX_PREPARED_POLLS, type PreparedPoll } from '@/lib/live-session';

// The poll questions a teacher set up for this class ahead of time, each
// launched with one click during it. Launched ones stay (to run again) but
// are marked, so the next unused one is easy to find.
export function PreparedPolls({
  polls, launchingId, onAdd, onLaunch, onEdit, onDelete,
}: {
  polls: PreparedPoll[];
  launchingId: string | null;
  onAdd: () => void;
  onLaunch: (poll: PreparedPoll) => void;
  onEdit: (poll: PreparedPoll) => void;
  onDelete: (poll: PreparedPoll) => void;
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  return (
    <section aria-label={t('live_prepared_title')} className="mt-5 border-t pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {t('live_prepared_title')}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{polls.length}</span>
        </h3>
        <Button size="sm" variant="outline" className="h-8" onClick={onAdd} disabled={polls.length >= MAX_PREPARED_POLLS}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t('live_prepared_add')}
        </Button>
      </div>
      {polls.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-4 text-center text-xs leading-5 text-muted-foreground">
          {t('live_prepared_empty')}
        </p>
      ) : (
        <ol className="space-y-2">
          {polls.map((poll, index) => (
            <li key={poll.id} className={`flex items-start gap-3 rounded-xl border p-3 ${poll.used ? 'bg-muted/40' : ''}`}>
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{poll.question}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {poll.used && (
                    <span className="mr-1.5 inline-flex items-center gap-0.5 text-primary">
                      <Check className="h-3 w-3" />{t('live_prepared_used')}
                    </span>
                  )}
                  {poll.options.join('／')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t('live_prepared_edit', { index: index + 1 })} onClick={() => onEdit(poll)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" aria-label={t('live_prepared_delete', { index: index + 1 })} onClick={() => onDelete(poll)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" className="h-8" disabled={launchingId !== null} onClick={() => onLaunch(poll)}>
                  {launchingId === poll.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
                  {t('live_prepared_launch')}
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
