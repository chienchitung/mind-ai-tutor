'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { EventsView } from '@/components/events/EventsView';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

export default function EventsPage() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  return (
    <AppLayout>
      <div className="space-y-4">
        <PageHeader
          heading={t('events_title')}
          text={t('events_desc')}
        />
        <EventsView />
      </div>
    </AppLayout>
  );
} 