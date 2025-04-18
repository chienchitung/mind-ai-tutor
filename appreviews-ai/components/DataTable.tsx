'use client';

import { useState } from 'react';
import type { Review } from '@/types/feedback';
import { useLanguage } from '../contexts/LanguageContext';

interface DataTableProps {
  data: Review[];
}

export default function DataTable({ data }: DataTableProps) {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const totalPages = Math.ceil(data.length / itemsPerPage);
  
  const getCurrentPageData = () => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return data.slice(start, end);
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-[10%] px-4 py-2 text-sm text-gray-500 border">{t('table.date') as string}</th>
              <th className="w-[10%] px-4 py-2 text-sm text-gray-500 border">{t('table.username') as string}</th>
              <th className="w-[35%] px-4 py-2 text-sm text-gray-500 border">{t('table.review') as string}</th>
              <th className="w-[5%] px-4 py-2 text-sm text-gray-500 border">{t('table.rating') as string}</th>
              <th className="w-[8%] px-4 py-2 text-sm text-gray-500 border">{t('table.platform') as string}</th>
              <th className="w-[25%] px-4 py-2 text-sm text-gray-500 border">{t('table.developerResponse') as string}</th>
              <th className="w-[7%] px-4 py-2 text-sm text-gray-500 border">{t('table.language') as string}</th>
            </tr>
          </thead>
          <tbody>
            {getCurrentPageData().map((review, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="w-[10%] px-4 py-2 text-xs text-gray-700 border truncate">
                  {review.date}
                </td>
                <td className="w-[10%] px-4 py-2 text-xs text-gray-700 border truncate">
                  {review.username}
                </td>
                <td className="w-[35%] px-4 py-2 text-xs text-gray-700 border">
                  <div className="max-h-32 overflow-y-auto">
                    {review.review}
                  </div>
                </td>
                <td className="w-[5%] px-4 py-2 text-xs text-gray-700 text-center border">
                  {review.rating}
                </td>
                <td className="w-[8%] px-4 py-2 text-xs text-gray-700 border truncate">
                  {review.platform}
                </td>
                <td className="w-[25%] px-4 py-2 text-xs text-gray-700 border">
                  <div className="max-h-32 overflow-y-auto">
                    {review.developerResponse}
                  </div>
                </td>
                <td className="w-[7%] px-4 py-2 text-xs text-gray-700 border truncate">
                  {review.language}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-center items-center gap-4 mt-4">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-4 py-2 text-sm bg-gray-100 rounded-md disabled:opacity-50"
        >
          {t('pagination.previous') as string}
        </button>
        <span className="text-sm text-gray-600">
          {t('pagination.info', { 
            current: currentPage.toString(), 
            total: totalPages.toString() 
          }) as string}
        </span>
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-4 py-2 text-sm bg-gray-100 rounded-md disabled:opacity-50"
        >
          {t('pagination.next') as string}
        </button>
      </div>
    </div>
  );
} 