'use client';

import DataScraper from '../components/DataScraper';
import { useLanguage } from '../contexts/LanguageContext';

export default function ScraperPage() {
  const { t } = useLanguage();
  
  return (
    <main className="min-h-screen bg-gray-100 pt-24">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            {t('scraper.title')}
          </h1>
          <DataScraper />
        </div>
      </div>
    </main>
  );
} 