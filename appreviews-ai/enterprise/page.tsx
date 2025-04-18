'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Building2, Phone, Mail } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function EnterprisePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 這裡處理表單提交邏輯
      await new Promise(resolve => setTimeout(resolve, 1500)); // 模擬 API 請求
      router.push('/enterprise/success');
    } catch (error) {
      console.error('提交錯誤:', error);
      alert(t('enterprise.error.submitFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            {t('enterprise.title')}
          </h2>
          <p className="mt-4 text-xl text-gray-600">
            {t('enterprise.subtitle')}
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('enterprise.form.companyName')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('enterprise.form.companyName.placeholder') as string}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('enterprise.form.contactPerson')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('enterprise.form.contactPerson.placeholder') as string}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('enterprise.form.email')}
                </label>
                <input
                  type="email"
                  required
                  placeholder={t('enterprise.form.email.placeholder') as string}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('enterprise.form.phone')}
                </label>
                <input
                  type="tel"
                  required
                  placeholder={t('enterprise.form.phone.placeholder') as string}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('enterprise.form.message')}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={t('enterprise.form.message.placeholder') as string}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition duration-150 ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? t('enterprise.form.submitting') : t('enterprise.form.submit')}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              {t('enterprise.features.title')}
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <Users className="h-6 w-6 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-semibold">{t('enterprise.features.support.title')}</h4>
                  <p className="text-gray-600">{t('enterprise.features.support.description')}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <Building2 className="h-6 w-6 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-semibold">{t('enterprise.features.customization.title')}</h4>
                  <p className="text-gray-600">{t('enterprise.features.customization.description')}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <Phone className="h-6 w-6 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-semibold">{t('enterprise.features.technical.title')}</h4>
                  <p className="text-gray-600">{t('enterprise.features.technical.description')}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <Mail className="h-6 w-6 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-semibold">{t('enterprise.features.contact.title')}</h4>
                  <p className="text-gray-600">support@appreviews.ai</p>
                  <p className="text-gray-600">+886 2 1234 5678</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 