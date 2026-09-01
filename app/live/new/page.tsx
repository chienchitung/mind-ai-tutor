'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  X,
  Loader2,
  ExternalLink,
  Copy,
  CheckCircle2,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

function presenterUrl(sessionId: string): string {
  return `/live/${sessionId}/present`;
}

function NewLiveSessionForm() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState<{
    sessionId: string;
    joinCode: string;
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (
      !title.trim() ||
      !question.trim() ||
      cleanOptions.length < 2 ||
      isCreating
    )
      return;
    setIsCreating(true);
    try {
      const response = await fetch('/api/live-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          question: question.trim(),
          options: cleanOptions,
        }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setCreated({ sessionId: data.sessionId, joinCode: data.joinCode });
    } catch {
      toast({
        title: t('error'),
        description: t('live_create_error'),
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyJoinLink = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/live/${created.joinCode}`,
      );
      toast({ title: t('link_copied') });
    } catch {
      toast({
        title: t('error'),
        description: t('live_copy_error'),
        variant: 'destructive',
      });
    }
  };

  if (created) {
    return (
      <div className="space-y-6">
        <PageHeader
          heading={t('live_created_title')}
          text={t('live_created_desc')}
        />
        <Card className="mx-auto max-w-xl">
          <CardContent className="space-y-5 p-6 text-center md:pt-6">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('live_join_code_label')}
              </p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="font-mono text-3xl tracking-widest">
                  {created.joinCode}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t('live_copy_link')}
                  onClick={() => void copyJoinLink()}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link href={presenterUrl(created.sessionId)}>
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                  {t('live_open_workspace')}
                </Link>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t('live_open_new_tab')}
                title={t('live_open_new_tab')}
                onClick={() =>
                  window.open(
                    presenterUrl(created.sessionId),
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreated(null);
                  setTitle('');
                  setQuestion('');
                  setOptions(['', '']);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {t('live_create_another')}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              <Link
                href="/live/sessions"
                className="underline-offset-4 hover:underline"
              >
                {t('live_view_all_sessions')}
              </Link>
              {' · '}
              <Link
                href="/dashboard"
                className="underline-offset-4 hover:underline"
              >
                {t('live_back_to_dashboard')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="min-h-11 px-0">
        <Link href="/live/sessions">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('live_view_all_sessions')}
        </Link>
      </Button>
      <PageHeader
        heading={t('live_new_session_title')}
        text={t('live_new_session_desc')}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)]">
        <Card>
          <CardContent className="p-5 sm:p-8 md:pt-8">
            <form onSubmit={handleSubmit} className="space-y-7">
              <h2 className="app-kicker">01 / {t('live_setup_details')}</h2>
              <div>
                <Label htmlFor="live-title">{t('live_title_label')}</Label>
                <Input
                  className="mt-2 h-12"
                  placeholder={t('live_setup_title_placeholder')}
                  id="live-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div>
                <h2 className="app-kicker mb-3 border-t pt-6">
                  02 / {t('live_setup_poll')}
                </h2>
                <p className="mb-4 text-sm leading-6 text-muted-foreground">
                  {t('live_setup_hint')}
                </p>
                <Label htmlFor="live-question">
                  {t('live_poll_question_label')}
                </Label>
                <Textarea
                  className="mt-2 min-h-24"
                  placeholder={t('live_setup_question_placeholder')}
                  id="live-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={2}
                  maxLength={500}
                  required
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t('live_poll_options_label')}
                </p>
                <p id="options-hint" className="text-xs text-muted-foreground">
                  {t('live_options_hint')}
                </p>
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-sm text-muted-foreground"
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <Input
                      className="h-11"
                      aria-label={`${t('live_poll_option_placeholder')} ${String.fromCharCode(65 + index)}`}
                      aria-describedby="options-hint"
                      value={option}
                      maxLength={120}
                      onChange={(event) =>
                        setOptions((previous) =>
                          previous.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder={`${t('live_poll_option_placeholder')} ${String.fromCharCode(65 + index)}`}
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('live_remove_option', {
                          option: String.fromCharCode(65 + index),
                        })}
                        onClick={() =>
                          setOptions((previous) =>
                            previous.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {options.length < 6 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOptions((previous) => [...previous, ''])}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {t('live_add_option')}
                  </Button>
                )}
              </div>
              <Button
                type="submit"
                className="h-12 w-full rounded-xl"
                disabled={
                  isCreating ||
                  !title.trim() ||
                  !question.trim() ||
                  options.filter((option) => option.trim()).length < 2
                }
              >
                {isCreating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t('live_start_session')}
              </Button>
            </form>
          </CardContent>
        </Card>
        <aside className="rounded-2xl border bg-muted/40 p-6 lg:sticky lg:top-6">
          <MessageSquare className="mb-4 h-6 w-6 text-muted-foreground" />
          <h2 className="font-semibold">{t('live_setup_next')}</h2>
          <ol className="mt-5 space-y-5">
            {(
              [
                'live_setup_step_1',
                'live_setup_step_2',
                'live_setup_step_3',
              ] as const
            ).map((key, index) => (
              <li key={key} className="flex gap-3 text-sm leading-6">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-card font-mono text-xs">
                  {index + 1}
                </span>
                <span className="text-muted-foreground">{t(key)}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

export default function NewLiveSessionPage() {
  return (
    <AppLayout>
      <NewLiveSessionForm />
    </AppLayout>
  );
}
