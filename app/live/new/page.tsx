'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2 } from 'lucide-react';
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

function NewLiveSessionForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (!title.trim() || !question.trim() || cleanOptions.length < 2 || isCreating) return;
    setIsCreating(true);
    try {
      const response = await fetch('/api/live-sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), question: question.trim(), options: cleanOptions }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      router.push(`/live/${data.sessionId}/present`);
    } catch {
      toast({ title: t('error'), description: t('live_create_error'), variant: 'destructive' });
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader heading={t('live_new_session_title')} text={t('live_new_session_desc')} />
      <Card className="mx-auto max-w-xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="live-title">{t('live_title_label')}</Label>
              <Input id="live-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
            </div>
            <div>
              <Label htmlFor="live-question">{t('live_poll_question_label')}</Label>
              <Textarea id="live-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} maxLength={500} required />
            </div>
            <div className="space-y-2">
              <Label>{t('live_poll_options_label')}</Label>
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input value={option} maxLength={120}
                    onChange={(event) => setOptions((previous) => previous.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                    placeholder={`${t('live_poll_option_placeholder')} ${String.fromCharCode(65 + index)}`} />
                  {options.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setOptions((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setOptions((previous) => [...previous, ''])}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />{t('live_add_option')}
                </Button>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('live_start_session')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewLiveSessionPage() {
  return <AppLayout><NewLiveSessionForm /></AppLayout>;
}
