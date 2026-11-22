'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { ClassroomToolsView } from '@/components/classroom-tools/ClassroomToolsView';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';

export default function ClassroomToolsPage() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  return (
    <div className="space-y-6">
      <PageHeader heading={t('classroom_tools')} text={t('classroom_tools_desc')} />
      <ClassroomToolsView />
    </div>
  );
}
