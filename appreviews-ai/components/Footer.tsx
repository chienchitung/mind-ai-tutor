'use client';

import Link from 'next/link';
import { useLanguage } from '../contexts/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  const footerRights = (t('footer.rights') as string).replace('{year}', new Date().getFullYear().toString());

  return (
    <footer className="bg-gray-800">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 平台介紹 */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">
              {t('footer.about')}
            </h3>
            <p className="text-gray-400 text-sm">
              {t('footer.aboutDesc')}
            </p>
          </div>
          
          {/* 快速連結 */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">
              {t('footer.quickLinks')}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/analysis" className="text-gray-400 hover:text-white text-sm">
                  {t('features.reviewAnalysis')}
                </Link>
              </li>
              <li>
                <Link href="/scraper" className="text-gray-400 hover:text-white text-sm">
                  {t('features.dataScraping')}
                </Link>
              </li>
              <li>
                <Link href="/competitor-analysis" className="text-gray-400 hover:text-white text-sm">
                  {t('features.competitorAnalysis')}
                </Link>
              </li>
              <li>
                <Link href="/learn" className="text-gray-400 hover:text-white text-sm">
                  {t('nav.learningCenter')}
                </Link>
              </li>
            </ul>
          </div>
          
          {/* 聯絡資訊 */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">
              {t('footer.contact')}
            </h3>
            <ul className="space-y-2">
              <li className="text-gray-400 text-sm">
                {t('footer.email')}
              </li>
              <li className="text-gray-400 text-sm">
                {t('footer.phone')}
              </li>
            </ul>
          </div>
        </div>
        
        {/* 版權資訊 */}
        <div className="mt-8 pt-8 border-t border-gray-700">
          <p className="text-center text-gray-400 text-sm">
            {footerRights}
          </p>
        </div>
      </div>
    </footer>
  );
} 