'use client';

import Link from 'next/link';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

export default function AuthCodeErrorPage() {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-3xl font-bold mb-4">{t('auth_error_title')}</h1>
      <p className="text-lg mb-6">
        {t('auth_error_desc')}
      </p>
      <Link
        href="/login"
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
      >
        {t('back_to_login')}
      </Link>
    </div>
  );
}
