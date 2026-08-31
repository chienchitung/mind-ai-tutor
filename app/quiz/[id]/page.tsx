'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface PublicQuestion {
  id: string;
  questionText: string;
  options: { id: string; text: string }[];
  questionType?: 'single' | 'multiple';
}
interface PublicQuiz { id: string; title: string; questions: PublicQuestion[] }

export default function PublicQuizPage() {
  const params = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [studentName, setStudentName] = useState('');
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/public/quizzes/${params.id}`, { cache: 'no-store' });
        if (!active) return;
        if (response.status === 404) { setStatus('not-found'); return; }
        if (!response.ok) { setStatus('error'); return; }
        const data = await response.json();
        setQuiz(data);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => { active = false; };
  }, [params.id]);

  const setSingleAnswer = (questionId: string, optionId: string) => {
    setAnswers(previous => ({ ...previous, [questionId]: optionId }));
  };
  const toggleMultiAnswer = (questionId: string, optionId: string, checked: boolean) => {
    setAnswers(previous => {
      const current = Array.isArray(previous[questionId]) ? previous[questionId] as string[] : [];
      const next = checked ? [...current, optionId] : current.filter(value => value !== optionId);
      return { ...previous, [questionId]: next };
    });
  };

  const handleSubmit = async () => {
    if (!quiz || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch(`/api/public/quizzes/${quiz.id}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName, answers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'ERROR');
      setResult(data);
    } catch {
      setSubmitError(t('public_quiz_submit_error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center p-4">
      <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />{t('public_quiz_loading')}</p>
    </div>;
  }
  if (status === 'not-found' || status === 'error') {
    return <div className="flex min-h-screen items-center justify-center p-4">
      <p role="alert" className="max-w-sm text-center text-muted-foreground">{t(status === 'not-found' ? 'public_quiz_not_found' : 'public_quiz_error')}</p>
    </div>;
  }
  if (!quiz) return null;

  if (result) {
    return <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 p-8 text-center shadow-lg">
        <h1 className="mb-4 text-2xl font-bold">{t('public_quiz_result_title')}</h1>
        <p className="mb-2 text-muted-foreground">{t('public_quiz_score_label')}</p>
        <p className="text-5xl font-bold text-indigo-600">{result.score} / {result.total}</p>
      </Card>
    </div>;
  }

  if (!started) {
    return <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles size={18} /></div>
          <h1 className="text-xl font-bold">{quiz.title}</h1>
        </div>
        <form onSubmit={event => { event.preventDefault(); if (studentName.trim()) setStarted(true); }} className="space-y-4">
          <div>
            <Label htmlFor="student-name">{t('public_quiz_name_label')}</Label>
            <Input id="student-name" value={studentName} onChange={event => setStudentName(event.target.value)} placeholder={t('public_quiz_name_placeholder')} maxLength={100} required autoFocus />
          </div>
          <Button type="submit" className="w-full" disabled={!studentName.trim()}>{t('public_quiz_start')}</Button>
        </form>
      </Card>
    </div>;
  }

  return <div className="min-h-screen bg-muted/20 px-4 py-8">
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
          <h1 className="text-2xl font-bold">{quiz.title}</h1>
          <p className="text-white/80">{t('questions_count', { count: quiz.questions.length })}</p>
        </CardHeader>
      </Card>

      {quiz.questions.map((question, index) => {
        const multiple = question.questionType === 'multiple';
        const value = answers[question.id];
        return <Card key={question.id} className="border-0 shadow-sm">
          <CardContent className="p-6">
            <p className="mb-4 font-medium">{index + 1}. {question.questionText}</p>
            {multiple ? (
              <div className="space-y-2">
                {question.options.map(option => {
                  const checked = Array.isArray(value) && value.includes(option.id);
                  return <label key={option.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <Checkbox checked={checked} onCheckedChange={next => toggleMultiAnswer(question.id, option.id, next === true)} />
                    {option.text}
                  </label>;
                })}
              </div>
            ) : question.options.length > 0 ? (
              <RadioGroup value={typeof value === 'string' ? value : undefined} onValueChange={next => setSingleAnswer(question.id, next)} className="space-y-2">
                {question.options.map(option => (
                  <label key={option.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <RadioGroupItem value={option.id} />
                    {option.text}
                  </label>
                ))}
              </RadioGroup>
            ) : (
              <Input value={typeof value === 'string' ? value : ''} onChange={event => setSingleAnswer(question.id, event.target.value)} maxLength={10000} />
            )}
          </CardContent>
        </Card>;
      })}

      {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
      <Button className="w-full py-6 text-lg" onClick={() => void handleSubmit()} disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {submitting ? t('public_quiz_submitting') : t('public_quiz_submit')}
      </Button>
    </div>
  </div>;
}
