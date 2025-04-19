'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

export default function ResetEventsPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const handleReset = () => {
    localStorage.removeItem('events');
    router.push('/events');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader 
          heading={t('reset_events')} 
          text={t('reset_events_desc')} 
        />
        
        <div className="bg-white p-6 border rounded-md shadow-sm">
          <p className="mb-4">
            {t('reset_warning')}
          </p>
          <Button variant="destructive" onClick={handleReset}>
            {t('reset_confirm')}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
} 