'use client';

import Link from 'next/link';
import { useLanguage } from '../contexts/LanguageContext';

export default function Privacy() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 pt-24">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('privacy.title')}</h1>
          <Link href="/signup" className="text-blue-600 hover:text-blue-800">
            {t('privacy.backToSignup')}
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg p-8 space-y-8">
          {/* Section 1 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('privacy.section1.title')}</h2>
            <p className="text-gray-700 mb-4">{t('privacy.section1.description')}</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600">
              <li>{t('privacy.section1.item1')}</li>
              <li>{t('privacy.section1.item2')}</li>
              <li>{t('privacy.section1.item3')}</li>
              <li>{t('privacy.section1.item4')}</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('privacy.section2.title')}</h2>
            <p className="text-gray-700 mb-4">{t('privacy.section2.description')}</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600">
              <li>{t('privacy.section2.item1')}</li>
              <li>{t('privacy.section2.item2')}</li>
              <li>{t('privacy.section2.item3')}</li>
              <li>{t('privacy.section2.item4')}</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('privacy.section3.title')}</h2>
            <p className="text-gray-700 mb-4">{t('privacy.section3.description')}</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600">
              <li>{t('privacy.section3.item1')}</li>
              <li>{t('privacy.section3.item2')}</li>
              <li>{t('privacy.section3.item3')}</li>
              <li>{t('privacy.section3.item4')}</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('privacy.section4.title')}</h2>
            <p className="text-gray-700 mb-4">{t('privacy.section4.description')}</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600">
              <li>{t('privacy.section4.item1')}</li>
              <li>{t('privacy.section4.item2')}</li>
              <li>{t('privacy.section4.item3')}</li>
              <li>{t('privacy.section4.item4')}</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('privacy.section5.title')}</h2>
            <p className="text-gray-700 mb-4">{t('privacy.section5.description')}</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600">
              <li>{t('privacy.section5.item1')}</li>
              <li>{t('privacy.section5.item2')}</li>
              <li>{t('privacy.section5.item3')}</li>
              <li>{t('privacy.section5.item4')}</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('privacy.section6.title')}</h2>
            <p className="text-gray-700 mb-4">{t('privacy.section6.description')}</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-600">
              <li>{t('privacy.section6.item1')}</li>
              <li>{t('privacy.section6.item2')}</li>
              <li>{t('privacy.section6.item3')}</li>
              <li>{t('privacy.section6.item4')}</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
} 