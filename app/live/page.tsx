'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-sm border-0 shadow-lg">
        <CardContent className="space-y-4 p-6">
          <h1 className="text-lg font-semibold">{t('live_join_title')}</h1>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="482910"
              inputMode="numeric"
              maxLength={6}
              aria-label={t('live_join_title')}
              className="text-center font-mono text-2xl tracking-[0.3em]"
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={code.length !== 6}>{t('live_join_button')}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
