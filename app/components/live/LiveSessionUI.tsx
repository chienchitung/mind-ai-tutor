'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Radio, Square } from 'lucide-react';
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
import { useTranslation } from '@/utils/translations';
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
}: {
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 text-muted-foreground"
          disabled={disabled}
        >
          <Square className="mr-1.5 h-3.5 w-3.5" />
          {t('live_action_closed')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('live_end_confirm_title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('live_end_confirm_desc')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('live_end_confirm_action')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
