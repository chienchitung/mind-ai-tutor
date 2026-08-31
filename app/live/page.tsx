'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LiveHeader } from '@/components/live/LiveSessionUI';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

export default function LiveJoinPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [code, setCode] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (/^[0-9]{6}$/.test(code)) router.push(`/live/${code}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <LiveHeader />
      <main className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-4 py-10">
        <div className="app-panel p-6 sm:p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border bg-muted">
            <Radio className="h-6 w-6" />
          </div>
          <p className="app-kicker mb-2">Live Session</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('live_join_title')}
          </h1>
          <p
            id="join-hint"
            className="mt-3 text-sm leading-6 text-muted-foreground"
          >
            {t('live_join_hint')}
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="join-code">{t('live_join_code_label')}</Label>
              <Input
                id="join-code"
                name="code"
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                      .normalize('NFKC')
                      .replace(/\D/g, '')
                      .slice(0, 6),
                  )
                }
                placeholder="000000"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="off"
                maxLength={6}
                aria-describedby="join-hint"
                required
                className="h-16 rounded-xl text-center font-mono text-3xl tracking-[0.25em]"
              />
            </div>
            <Button
              type="submit"
              className="h-12 w-full rounded-xl"
              disabled={code.length !== 6}
            >
              {t('live_join_button')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>
        <p className="px-4 pt-6 text-center text-xs leading-6 text-muted-foreground">
          {t('live_join_note')}
        </p>
      </main>
    </div>
  );
}
