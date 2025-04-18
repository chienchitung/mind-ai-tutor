'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle, Clock } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function EnterpriseSuccessPage() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {t('enterprise.success.title')}
        </h1>
        
        <div className="text-gray-600 mb-8 space-y-4">
          <div className="flex items-center justify-center space-x-2 text-blue-600">
            <Clock className="h-5 w-5" />
            <span>{t('enterprise.success.response')}</span>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg text-left">
            <h3 className="font-semibold mb-2">{t('enterprise.success.process.title')}</h3>
            <ul className="space-y-2 text-sm">
              <li>{t('enterprise.success.process.step1')}</li>
              <li>{t('enterprise.success.process.step2')}</li>
              <li>{t('enterprise.success.process.step3')}</li>
            </ul>
          </div>
          
          <p className="text-sm">
            {t('enterprise.success.urgent')}
            <br />
            <a href="tel:+886223456789" className="text-blue-600">
              +886 2 2345 6789
            </a>
          </p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 transition duration-150"
        >
          {t('enterprise.success.button')}
        </button>
      </div>
    </div>
  );
} 