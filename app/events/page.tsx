'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { EventsView } from '@/components/events/EventsView';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

export default function EventsPage() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
      <div className="space-y-6">
        <PageHeader
          heading={t('events_title')}
          text={t('events_desc')}
        />
        <EventsView />
      </div>
  );
}
