'use client';

import { useState } from 'react';
import DataTable from './DataTable';
import type { Review } from '@/types/feedback';
import * as XLSX from 'xlsx';
import { useLanguage } from '../contexts/LanguageContext';

interface StoreUrls {
  appleStore: string;
  googlePlay: string;
}

export default function DataScraper() {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [storeUrls, setStoreUrls] = useState<StoreUrls>({
    appleStore: '',
    googlePlay: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    appleApp: string | null;
    googleApp: string | null;
  } | null>(null);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setStoreUrls(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleScrape = async () => {
    try {
      if (!storeUrls.appleStore && !storeUrls.googlePlay) {
        setError('請至少輸入一個商店的 URL');
        return;
      }

      setIsLoading(true);
      setError(null);
      setShowTable(false);

      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(storeUrls),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || '爬蟲請求失敗');
      }

      // 將搜尋結果的應用程式名稱加入到評論資料中
      const reviewsWithAppName = result.data.map((review: Review) => {
        // 如果有搜尋結果，優先使用 Apple Store 的應用程式名稱
        const appName = searchResults?.appleApp || searchResults?.googleApp || '';
        return {
          ...review,
          appName
        };
      });

      setReviews(reviewsWithAppName);
      setShowTable(true);
      
    } catch (error) {
      console.error('爬蟲錯誤:', error);
      setError(error instanceof Error ? error.message : '爬蟲執行失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!reviews.length) return;

    // 準備 Excel 資料
    const excelData = reviews.map(row => ({
      日期: row.date || '',
      使用者: row.username || '',
      評論: row.review || '',
      評分: row.rating || 0,
      平台: row.platform || '',
      開發者回覆: row.developerResponse || '',
      語言: row.language || '',
      應用程式名稱: row.appName || ''
    }));

    // 建立工作簿
    const wb = XLSX.utils.book_new();
    // 將資料轉換為工作表
    const ws = XLSX.utils.json_to_sheet(excelData);

    // 設定欄寬
    const columnWidths = [
      { wch: 15 },  // 日期
      { wch: 15 },  // 使用者
      { wch: 50 },  // 評論
      { wch: 8 },   // 評分
      { wch: 15 },  // 平台
      { wch: 50 },  // 開發者回覆
      { wch: 10 },  // 語言
      { wch: 30 }   // 應用程式名稱
    ];
    ws['!cols'] = columnWidths;

    // 將工作表加入工作簿
    XLSX.utils.book_append_sheet(wb, ws, "評論資料");

    // 下載檔案
    XLSX.writeFile(wb, `app_reviews_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSearch = async () => {
    try {
      setIsSearching(true);
      setError(null);
      setSearchResults(null);

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '搜尋失敗');
      }

      const appStoreApp = result.data.find((app: any) => app.platform === 'Apple App Store');
      const playStoreApp = result.data.find((app: any) => app.platform === 'Google Play Store');

      setStoreUrls({
        appleStore: appStoreApp?.link || '',
        googlePlay: playStoreApp?.link || ''
      });

      setSearchResults({
        appleApp: appStoreApp?.name || null,
        googleApp: playStoreApp?.name || null
      });

    } catch (error) {
      setError(error instanceof Error ? error.message : '搜尋失敗，請稍後再試');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    // 清除搜尋相關狀態
    setSearchTerm('');
    setStoreUrls({
      appleStore: '',
      googlePlay: ''
    });
    setSearchResults(null);
    setError(null);
    
    // 清除爬取相關狀態
    setReviews([]);
    setShowTable(false);
    setIsLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* 搜尋區塊 */}
      <div className="px-4 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={t('scraper.inputAppName') as string}
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              disabled={isSearching}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchTerm.trim()}
            className="px-5 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2.5 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
            title={t('button.clear') as string}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* 搜尋結果顯示 */}
        {searchResults && (
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 font-medium">
                  {t('scraper.searchResults') as string}: {searchResults.appleApp || t('scraper.noResults') as string}
                </span>
              </div>
              {searchResults.appleApp && (
                <div className="text-sm text-gray-500 bg-white p-3 rounded-lg border border-gray-100">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    {t('scraper.confirmApp') as string}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 應用程式評論爬取區塊 */}
      <div className="px-4">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-600">
                {t('scraper.appStoreLink') as string}
              </label>
              <input
                type="text"
                name="appleStore"
                value={storeUrls.appleStore}
                onChange={handleUrlChange}
                placeholder={t('scraper.appStorePlaceholder') as string}
                className="w-full px-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-600">
                {t('scraper.playStoreLink') as string}
              </label>
              <input
                type="text"
                name="googlePlay"
                value={storeUrls.googlePlay}
                onChange={handleUrlChange}
                placeholder={t('scraper.playStorePlaceholder') as string}
                className="w-full px-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleScrape}
              disabled={isLoading}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 
              transition-all transform active:scale-95 disabled:opacity-50 
              disabled:cursor-not-allowed focus:outline-none focus:ring-2 
              focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('scraper.processing') as string}
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  {t('scraper.startScraping') as string}
                </>
              )}
            </button>
          </div>
          
          {error && (
            <p className="text-center text-red-600 mt-4 px-4 py-2 bg-red-50 rounded-lg">
              <span className="flex items-center gap-2 justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </span>
            </p>
          )}
        </div>

        {/* 評論資料表部分 */}
        {reviews.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">
                {t('scraper.reviewData') as string} ({reviews.length} {t('scraper.reviewCount') as string})
              </h2>
              <button
                onClick={() => setShowTable(!showTable)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 
                rounded-xl transition-all transform active:scale-95 
                focus:outline-none focus:ring-2 focus:ring-gray-200 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  {showTable ? (
                    <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  )}
                </svg>
                {showTable ? t('scraper.hideTable') as string : t('scraper.showTable') as string}
              </button>
            </div>

            {showTable && (
              <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <DataTable data={reviews} />
              </div>
            )}

            <div className="flex justify-center pt-4">
              <button
                onClick={handleDownloadExcel}
                className="px-6 py-2.5 bg-green-500 text-white rounded-xl 
                hover:bg-green-600 transition-all transform active:scale-95 
                focus:outline-none focus:ring-2 focus:ring-green-500 
                focus:ring-offset-2 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                {t('button.download') as string} Excel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 