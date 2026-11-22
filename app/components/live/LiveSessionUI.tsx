'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, Pencil, Radio, Square, X } from 'lucide-react';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { Checkbox } from '@/components/ui/checkbox';
import type { LiveSessionStatus } from '@/lib/live-session';

export function SessionStatus({ status }: { status: LiveSessionStatus }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const colors = {
    open: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    paused: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    closed: 'bg-muted text-muted-foreground',
  };
  return (
    <span
      role="status"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${colors[status]}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
      {t(`live_status_${status}`)}
    </span>
  );
}

// The course name at the top of the presenter page, renamed in place:
// Enter or the check saves, Escape or the cross cancels.
export function EditableSessionTitle({
  title, onSave,
}: {
  title: string;
  /** Resolves false when the save failed, keeping the editor open. */
  onSave: (title: string) => Promise<boolean>;
}) {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const next = draft?.trim() ?? '';
    if (!next || saving) return;
    if (next === title) { setDraft(null); return; }
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (ok) setDraft(null);
  };
  if (draft === null) {
    return (
      <div className="group flex min-w-0 items-center gap-1">
        <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl" title={title}>{title}</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          aria-label={zh ? '修改課程名稱' : 'Rename course'}
          onClick={() => setDraft(title)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex min-w-0 items-center gap-1"
      onSubmit={(event) => { event.preventDefault(); void save(); }}
    >
      <input
        autoFocus
        value={draft}
        maxLength={200}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Escape') setDraft(null); }}
        aria-label={zh ? '課程名稱' : 'Course name'}
        className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-lg font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={saving || !draft.trim()} aria-label={zh ? '儲存課程名稱' : 'Save course name'}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={saving} aria-label={zh ? '取消' : 'Cancel'} onClick={() => setDraft(null)}>
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
}

export function LiveHeader({ presenter = false }: { presenter?: boolean }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="w-36 sm:w-40" aria-label="MindAiTutor">
            <BrandLogo />
          </Link>
          <span className="hidden border-l pl-4 text-xs font-medium text-muted-foreground sm:block">
            Live Session
          </span>
        </div>
        {presenter ? (
          <Button asChild variant="ghost" className="min-h-11 px-2 text-xs">
            <Link href="/live/sessions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('live_view_all_sessions')}
            </Link>
          </Button>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Radio className="h-3.5 w-3.5" />
            {t('live_student_space')}
          </span>
        )}
      </div>
    </header>
  );
}

export function LivePageState({
  loading,
  message,
  children,
  presenter = false,
}: {
  loading?: boolean;
  message: string;
  children?: ReactNode;
  presenter?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <LiveHeader presenter={presenter} />
      <main className="mx-auto flex min-h-[65vh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        {loading && (
          <Loader2
            aria-hidden="true"
            className="h-6 w-6 animate-spin text-muted-foreground"
          />
        )}
        <p
          role={loading ? 'status' : 'alert'}
          className="text-sm leading-6 text-muted-foreground"
        >
          {message}
        </p>
        {children}
      </main>
    </div>
  );
}

export function EndSessionButton({
  onConfirm,
  disabled,
  compact = false,
  offerDeckShare = false,
}: {
  /** shareDeck: whether students may still open the slides afterwards. */
  onConfirm: (options: { shareDeck: boolean }) => void;
  disabled?: boolean;
  /** The session has slides: ask whether students keep access to them. */
  offerDeckShare?: boolean;
  /** Icon only on narrow screens (the presenter's top bar). */
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  // Off by default every time the dialog opens: sharing is a deliberate choice.
  const [shareDeck, setShareDeck] = useState(false);
  return (
    <AlertDialog onOpenChange={(open) => { if (open) setShareDeck(false); }}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={compact ? 'h-10 px-3 text-muted-foreground' : 'min-h-11 text-muted-foreground'}
          disabled={disabled}
        >
          <Square className={compact ? 'h-3.5 w-3.5 sm:mr-1.5' : 'mr-1.5 h-3.5 w-3.5'} />
          <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>{t('live_action_closed')}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('live_end_confirm_title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('live_end_confirm_desc')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {offerDeckShare && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/40 p-3 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={shareDeck}
              onCheckedChange={(value) => setShareDeck(value === true)}
            />
            <span className="space-y-0.5">
              <span className="block font-medium">{t('live_end_share_deck')}</span>
              <span className="block text-xs text-muted-foreground">{t('live_end_share_deck_hint')}</span>
            </span>
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm({ shareDeck: offerDeckShare && shareDeck })}>
            {t('live_end_confirm_action')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
