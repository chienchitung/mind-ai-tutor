'use client';

import { useState, useRef, useEffect } from 'react';
import type { AnalysisResult } from '@/types/feedback';
import Image from "next/image";
import { SentimentPieChart } from '../components/charts/SentimentPieChart';
import { KeywordsBarChart } from '../components/charts/KeywordsBarChart';
import { WordCloud } from '../components/charts/WordCloud';
import { MonthlyTrendChart, RatingDistributionChart } from '../components/charts/TrendChart';
import { CategoryBarChart } from '../components/charts/CategoryBarChart';
import { useLanguage } from '../contexts/LanguageContext';

// 自定義 Logo SVG 組件 - AI 字樣
const LogoSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <g transform="scale(0.213333)">
      <rect width="150" height="150" fill="#F9F9F9"/>    
      {/* 中間大四角星 */}
      <path d="M96.1375 51.2609C101.308 50.3007 104.299 47.2723 105.149 42.1759C105.684 47.0877 109.432 50.633 114.086 51.2239C108.971 52.1657 105.961 55.1755 105.112 60.3273C104.853 57.9822 103.93 55.9141 102.268 54.2153C100.569 52.5165 98.5195 51.5563 96.1375 51.2609Z" fill="currentColor"/>
      {/* 左上小四角星 */}
      <path d="M37.3222 78.0925C59.6985 73.9369 72.6448 60.8307 76.3209 38.7741C78.6385 60.0316 94.8613 75.3753 115 77.9326C92.8634 82.0083 79.8372 95.0345 76.1611 117.331C75.0423 107.182 71.0465 98.2312 63.8541 90.8789C56.5019 83.5267 47.6313 79.3711 37.3222 78.0925Z" fill="currentColor"/>
      {/* 右上小四角星 */}
      <path d="M35 44.7824C41.8937 43.5022 45.8822 39.4644 47.0148 32.6692C47.7288 39.2182 52.7267 43.9453 58.931 44.7332C52.1112 45.9888 48.0981 50.002 46.9655 56.8711C46.6208 53.7443 45.3898 50.9868 43.174 48.7217C40.9089 46.4566 38.176 45.1764 35 44.7824Z" fill="currentColor"/>
    </g>
  </svg>
);

// 修改 filters 的型別定義
interface Filters {
  dateRange: {
    start: string;
    end: string;
  };
  devices: string[];
  ratings: number[];
  sentiments: string[];  // 這裡存儲 'positive', 'neutral', 'negative'
  categories: string[];
  companies: string[];  // 新增公司篩選欄位
}

// 新增點擊外部關閉的 hook
const useClickOutside = (ref: React.RefObject<HTMLElement>, handler: () => void) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, handler]);
};

// 新增日期驗證函數
const validateDateInput = (dateString: string) => {
  if (!dateString) return '';
  
  let [year, month, day] = dateString.split('-').map(part => part || '');
  
  // 限制年份為四位數字
  if (year && year.length > 4) {
    year = year.slice(0, 4);
  }

  // 確保月份在 1-12 之間
  if (month) {
    const monthNum = parseInt(month);
    if (isNaN(monthNum) || monthNum < 1) month = '01';
    if (monthNum > 12) month = '12';
  }

  // 根據月份取得該月最大天數
  const getMaxDaysInMonth = (year: string, month: string) => {
    const monthNum = parseInt(month);
    if (!monthNum || isNaN(monthNum)) return 31;

    // 檢查是否為閏年
    const yearNum = parseInt(year);
    const isLeapYear = yearNum && !isNaN(yearNum) && 
      (yearNum % 4 === 0 && (yearNum % 100 !== 0 || yearNum % 400 === 0));
    
    // 每月天數對照表
    const daysInMonth = {
      1: 31, 2: isLeapYear ? 29 : 28, 3: 31, 4: 30,
      5: 31, 6: 30, 7: 31, 8: 31,
      9: 30, 10: 31, 11: 30, 12: 31
    };
    
    return daysInMonth[monthNum as keyof typeof daysInMonth] || 31;
  };

  // 驗證並修正日期
  if (day) {
    const maxDays = getMaxDaysInMonth(year, month);
    const dayNum = parseInt(day);
    if (isNaN(dayNum) || dayNum < 1) day = '01';
    if (dayNum > maxDays) day = maxDays.toString().padStart(2, '0');
  }

  // 組合日期字串，確保每個部分都有值時才加入
  const dateParts = [];
  if (year) dateParts.push(year);
  if (month) dateParts.push(month.padStart(2, '0'));
  if (day) dateParts.push(day.padStart(2, '0'));
  
  return dateParts.join('-');
};

interface AnalysisProgress {
  status: 'idle' | 'processing' | 'completed' | 'error';
  percentage: number;
  currentStep: string;
}

export default function AnalysisPage() {
  const { t, language } = useLanguage();  // 確保引入 language
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // 計算總頁數
  const totalPages = analysisResult ? Math.ceil(analysisResult.feedbacks.length / itemsPerPage) : 0;

  // 獲取當前頁的數據
  const getCurrentPageData = () => {
    if (!analysisResult) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return analysisResult.feedbacks.slice(startIndex, startIndex + itemsPerPage);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files[0]) {
      const file = files[0];
      // 檢查檔案類型
      if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
        alert('請上傳 .csv, .xlsx 或 .xls 格式的檔案');
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; // 清除無效的選擇
        }
        return;
      }
      // 檢查檔案大小（例如限制在 10MB 以內）
      if (file.size > 10 * 1024 * 1024) {
        alert('檔案大小不能超過 10MB');
        if (fileInputRef.current) {
          fileInputRef.current.value = ''; // 清除無效的選擇
        }
        return;
      }
      console.log('File selected:', file.name);
      setFile(file);
      // 重置分析相關的狀態
      setAnalysisResult(null);
      setUploadStatus('idle');
      setErrorMessage('');
    }
  };

  // 新增一個 state 來保存原始數據
  const [originalData, setOriginalData] = useState<AnalysisResult | null>(null);

  // 在 AnalysisPage 組件中添加一個新的 state 來存儲所有可用的分類
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allCompanies, setAllCompanies] = useState<string[]>([]);  // 新增公司列表 state

  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({
    status: 'idle',
    percentage: 0,
    currentStep: ''
  });

  // 修改 handleAnalyze 函數中的類型定義
  const handleAnalyze = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setAnalysisProgress({
      status: 'processing',
      percentage: 0,
      currentStep: String(t('analysis.steps.preparing'))
    });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const textDecoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        // 將新的數據添加到緩衝區
        buffer += textDecoder.decode(value, { stream: true });
        
        // 處理完整的訊息
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最後一個不完整的行

        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const message = JSON.parse(line);
            
            switch (message.type) {
              case 'progress':
                setAnalysisProgress(prev => ({
                  ...prev,
                  percentage: message.data.percentage,
                  currentStep: String(message.data.step)
                }));
                break;

              case 'result':
                const result = message.data;
                // 提取所有唯一的分類
                const uniqueCategories = Array.from(new Set(
                  result.feedbacks.flatMap((f: { category: string }) => 
                    f.category.split(/[,，]/).map((c: string) => c.trim())
                  )
                )) as string[];

                // 提取所有唯一的公司
                const uniqueCompanies = Array.from(new Set(
                  result.feedbacks.map((f: { company: string }) => f.company)
                )) as string[];

                // 設置所有可用的分類和公司
                setAllCategories(uniqueCategories);
                setAllCompanies(uniqueCompanies);
                
                // 保存原始數據
                setOriginalData(result);
                setAnalysisResult(result);
                break;

              case 'error':
                throw new Error(message.data);
            }
          } catch (e) {
            console.error('Error processing message:', e, 'Line:', line);
          }
        }
      }

      setAnalysisProgress(prev => ({
        ...prev,
        status: 'completed',
        percentage: 100,
        currentStep: String(t('analysis.steps.completed'))
      }));

    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisProgress(prev => ({
        ...prev,
        status: 'error',
        percentage: 0,
        currentStep: String(t('analysis.steps.error'))
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      // 檢查檔案類型
      if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
        alert('請上傳 .csv, .xlsx 或 .xls 格式的檔案');
        return;
      }
      // 檢查檔案大小
      if (file.size > 10 * 1024 * 1024) {
        alert('檔案大小不能超過 10MB');
        return;
      }
      setFile(file);
      // 重置分析相關的狀態
      setAnalysisResult(null);
      setUploadStatus('idle');
      setErrorMessage('');
      // 清除 input 的值，確保可以重新選擇相同檔案
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      // 清除當前的值，這樣即使選擇相同的檔案也會觸發 onChange 事件
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // 添加新的 state 來儲存 AI 分析結果
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  // 替換原來的 downloadReport 函數
  const generateInsights = async () => {
    if (!analysisResult) return;
    
    setIsGeneratingInsights(true);
    try {
      const response = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: analysisResult.keywords,
          totalFeedbacks: analysisResult.summary.totalCount,
          averageRating: analysisResult.summary.averageRating,
          positiveRatio: analysisResult.summary.positiveRatio,
          neutralRatio: analysisResult.summary.neutralRatio,
          negativeRatio: analysisResult.summary.negativeRatio,
        }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setAiAnalysis(data.analysis);
    } catch (error) {
      console.error('生成分析時發生錯誤:', error);
      alert('生成分析時發生錯誤，請稍後再試');
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const [showDataTable, setShowDataTable] = useState(true);

  // 新增篩選器區塊
  const [filters, setFilters] = useState<Filters>({
    dateRange: { start: '', end: '' },
    devices: [],
    ratings: [],
    sentiments: [],
    categories: [],
    companies: []  // 新增公司重置
  });

  // 修改 handleFilterChange 函數
  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    
    if (originalData) {
      // 每次都從原始數據開始篩選
      const filteredData = originalData.feedbacks.filter(feedback => {
        const date = new Date(feedback.date);
        const matchDate = (!newFilters.dateRange.start || date >= new Date(newFilters.dateRange.start)) &&
                         (!newFilters.dateRange.end || date <= new Date(newFilters.dateRange.end));
        const matchDevice = newFilters.devices.length === 0 || newFilters.devices.includes(feedback.device);
        const matchRating = newFilters.ratings.length === 0 || newFilters.ratings.includes(Math.floor(feedback.rating));
        const matchCompany = newFilters.companies.length === 0 || newFilters.companies.includes(feedback.company);
        
        // 修改情感比對邏輯
        const sentimentMap: { [key: string]: string } = {
          'positive': '正面',
          'neutral': '中性',
          'negative': '負面'
        };
        const matchSentiment = newFilters.sentiments.length === 0 || 
                            newFilters.sentiments.some(s => feedback.sentiment === sentimentMap[s]);
        
        const matchCategory = newFilters.categories.length === 0 || 
                            feedback.category.split(/[,，]/).some(cat => newFilters.categories.includes(cat.trim()));
        
        return matchDate && matchDevice && matchRating && matchSentiment && matchCategory && matchCompany;
      });

      // 更新摘要數據
      const summary = {
        totalCount: filteredData.length,
        positiveRatio: filteredData.filter(f => f.sentiment === '正面').length / filteredData.length || 0,
        neutralRatio: filteredData.filter(f => f.sentiment === '中性').length / filteredData.length || 0,
        negativeRatio: filteredData.filter(f => f.sentiment === '負面').length / filteredData.length || 0,
        averageRating: filteredData.length ? filteredData.reduce((acc, curr) => acc + curr.rating, 0) / filteredData.length : 0
      };

      // 計算關鍵字統計
      const keywordCounts = filteredData.reduce((acc, feedback) => {
        feedback.keywords.forEach(keyword => {
          acc[keyword] = (acc[keyword] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>);

      const keywords = Object.entries(keywordCounts)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count);

      // 更新分析結果
      setAnalysisResult({
        ...originalData,  // 保持原始數據的其他屬性
        feedbacks: filteredData,
        summary,
        keywords
      });

      // 重置分頁到第一頁
      setCurrentPage(1);
    }
  };

  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // 使用 hook
  useClickOutside(datePickerRef, () => setShowDatePicker(false));

  // 設定預設日期範圍 (Year to month)
  const getDefaultDateRange = () => {
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const year = today.getFullYear();
    const month = today.getMonth();

    const startOfYear = new Date(Date.UTC(year, 0, 1)); // 今年1月1日
    const lastMonth = new Date(Date.UTC(year, month - 1, 1)); // 上個月1號

    return {
      start: startOfYear.toISOString().split('T')[0],
      end: lastMonth.toISOString().split('T')[0]
    };
  };

  // 修改時間範圍的處理函數
  const handleQuickDateSelect = (option: string) => {
    // 用台北時區獲取當前日期
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    today.setHours(0, 0, 0, 0);

    let start: Date;
    let end: Date;

    switch (option) {
      case 'thisMonth': {
        // 本月1號到當前日期
        const year = today.getFullYear();
        const month = today.getMonth();
        const currentDate = today.getDate();
        
        start = new Date(Date.UTC(year, month, 1)); // 本月1號
        end = new Date(Date.UTC(year, month, currentDate)); // 當前日期
        break;
      }
      case 'lastMonth': {
        // 上個月的完整月份 (1號到月底)
        const year = today.getFullYear();
        const month = today.getMonth() - 1;
        
        start = new Date(Date.UTC(year, month, 1)); // 上個月1號
        end = new Date(Date.UTC(year, month + 1, 0)); // 上個月最後一天
        break;
      }
      case 'last7days': {
        // 今天往前推7天，不包含今天
        end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 1)); // 昨天
        start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 7)); // 7天前
        break;
      }
      case 'last14days': {
        // 今天往前推14天，不包含今天
        end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 1)); // 昨天
        start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 14)); // 14天前
        break;
      }
      case 'last30days': {
        // 今天往前推30天，不包含今天
        end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 1)); // 昨天
        start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 30)); // 30天前
        break;
      }
      case 'last3Months': {
        // 今天月份的上個月加上前2個月，不包含本月
        const year = today.getFullYear();
        const month = today.getMonth();
        
        // 3個月前的1號到上個月最後一天
        start = new Date(Date.UTC(year, month - 3, 1)); // 3個月前的1號
        end = new Date(Date.UTC(year, month, 0)); // 上個月的最後一天
        break;
      }
      default:
        return;
    }

    // 轉換為 ISO 字符串並只取日期部分 (YYYY-MM-DD)
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    handleFilterChange({
      ...filters,
      dateRange: {
        start: formatDate(start),
        end: formatDate(end)
      }
    });
  };

  // 修改重置篩選函數
  const handleResetFilters = () => {
    // 重置篩選條件
    setFilters({
      dateRange: { start: '', end: '' },
      devices: [],
      ratings: [],
      sentiments: [],
      categories: [],
      companies: []  // 新增公司重置
    });
    
    // 重置所有圖表和數據到初始狀態
    if (originalData) {
      setAnalysisResult({
        ...originalData,
        feedbacks: originalData.feedbacks,
        summary: {
          totalCount: originalData.feedbacks.length,
          positiveRatio: originalData.feedbacks.filter(f => f.sentiment === '正面').length / originalData.feedbacks.length,
          neutralRatio: originalData.feedbacks.filter(f => f.sentiment === '中性').length / originalData.feedbacks.length,
          negativeRatio: originalData.feedbacks.filter(f => f.sentiment === '負面').length / originalData.feedbacks.length,
          averageRating: originalData.feedbacks.reduce((acc, curr) => acc + curr.rating, 0) / originalData.feedbacks.length
        },
        keywords: originalData.keywords
      });
    }
    
    // 重置分頁到第一頁
    setCurrentPage(1);
    
    // 關閉日期選擇器
    setShowDatePicker(false);
  };

  // 將 formatDisplayDate 移到組件內部
  const formatDisplayDate = (dateString: string, currentLanguage: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    return currentLanguage === 'zh' 
      ? `${year}${t('filter.date.year')}${month}${t('filter.date.month')}${day}${t('filter.date.day')}`
      : `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  // 將 convertLocaleDateToISO 函數移到組件內部
  const convertLocaleDateToISO = (dateString: string) => {
    if (!dateString) return '';
    
    // 處理 "YYYY年MM月DD日" 格式
    const matches = dateString.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
    if (matches) {
      const [_, year, month, day] = matches;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return dateString;
  };

  // 在 AnalysisPage 組件中新增狀態
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const companyDropdownRef = useRef<HTMLDivElement>(null);

  // 使用 useClickOutside hook 關閉下拉選單
  useClickOutside(companyDropdownRef, () => setShowCompanyDropdown(false));

  return (
    <main className="max-w-7xl mx-auto px-4 pt-24 pb-16">
      {/* 使用說明區塊 */}
      <section className="mb-8 bg-blue-50 rounded-xl p-6 shadow-sm">
        <div className="flex items-start space-x-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">{t('analysis.title')}</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>{t('analysis.uploadDesc')}</p>
              <p>{t('analysis.fileRequirement')}</p>
              <p>{t('analysis.autoAnalysis')}</p>
              <ul className="list-disc list-inside pl-4 space-y-1">
                {(t('analysis.features') as string[]).map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
              <p>{t('analysis.generateReport')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 檔案上傳區域 */}
      <section className="mb-12 bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">{t('analysis.uploadTitle')}</h2>
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
          onClick={handleUploadClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept=".csv,.xlsx,.xls" 
            onChange={handleFileUpload}
          />
          {file ? (
            <div className="space-y-2">
              <svg className="w-12 h-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-gray-600 dark:text-gray-300">{file.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('button.upload')}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {t('analysis.uploadDragText')}
              </p>
            </>
          )}
        </div>
      </section>

      {/* 分析按鈕 */}
      <section className="mb-8 flex justify-center">
        <button 
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleAnalyze}
          disabled={!file || isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{t('analysis.processing')}</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>{t('analysis.startButton')}</span>
            </>
          )}
        </button>
      </section>

      {/* 分析結果預覽 */}
      {analysisResult && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">{t('analysis.preview')}</h2>
            <button
              onClick={() => setShowDataTable(!showDataTable)}
              className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              {showDataTable ? (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  {t('scraper.hideTable')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {t('scraper.showTable')}
                </>
              )}
            </button>
          </div>
          
          {showDataTable && (
            <section className="mb-12 bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 w-32">{t('table.company')}</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 w-32">{t('table.date')}</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600">{t('table.review')}</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 w-24">{t('table.rating')}</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 w-32">{t('table.device')}</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 w-32">{t('table.category')}</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 w-32">{t('table.sentiment')}</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-600 w-48">{t('table.keywords')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {getCurrentPageData().map((feedback: AnalysisResult['feedbacks'][0], index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{feedback.company}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{feedback.date}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{feedback.content}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{feedback.rating}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{feedback.device}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {feedback.category.split(/[,，]/).map((category: string, cidx: number) => (
                              <span 
                                key={cidx} 
                                className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800"
                              >
                                {category.trim()}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            feedback.sentiment.includes('正面') ? 'bg-green-100 text-green-800' :
                            feedback.sentiment.includes('負面') ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {feedback.sentiment}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {feedback.keywords.map((keyword: string, kidx: number) => (
                              <span 
                                key={kidx} 
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* 新增分頁控制區域 */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-700">
                    <span>
                      {t('pagination.showing')} {((currentPage - 1) * itemsPerPage) + 1} {t('pagination.to')} {Math.min(currentPage * itemsPerPage, analysisResult.feedbacks.length)} {t('pagination.of')} {analysisResult.feedbacks.length} {t('pagination.entries')}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg 
                        className="h-5 w-5 mr-1" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M15 19l-7-7 7-7" 
                        />
                      </svg>
                      {t('pagination.previous')}
                    </button>
                    
                    {/* 頁碼顯示 */}
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <span className="px-2 py-2 text-gray-500">...</span>
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('pagination.next')}
                      <svg 
                        className="h-5 w-5 ml-1" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M9 5l7 7-7 7" 
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 新增篩選器區塊 - 重新設計本區塊 */}
          <section className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">{t('analysis.filter')}</h2>
              </div>
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('filter.reset')}
              </button>
            </div>

            <div className="space-y-6">
              {/* 第一行：時間範圍和公司篩選 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 時間範圍篩選 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  <span className="flex items-center space-x-1">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                      <span>{t('filter.dateRange')}</span>
                  </span>
                </label>
                  <div className="relative" ref={datePickerRef}>
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {filters.dateRange.start && filters.dateRange.end
                            ? `${formatDisplayDate(filters.dateRange.start, language)} ${t('to')} ${formatDisplayDate(filters.dateRange.end, language)}`
                            : t('filter.selectDateRange')}
                        </span>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} 
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                </div>
                    </button>

                    {showDatePicker && (
                      <div className="absolute z-50 w-full md:w-[500px] mt-1 bg-white rounded-lg shadow-lg border border-gray-200">
                        <div className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="space-y-1">
                              <label className="block text-xs text-gray-500">{t('filter.startDate')}</label>
                              <input
                                type="date"
                                value={filters.dateRange.start}
                                onChange={(e) => {
                                  let value = e.target.value;
                                  value = convertLocaleDateToISO(value);
                                  const validatedDate = validateDateInput(value);
                                  if (validatedDate !== value) {
                                    e.target.value = validatedDate;
                                  }
                                  handleFilterChange({
                                    ...filters,
                                    dateRange: { ...filters.dateRange, start: validatedDate }
                                  });
                                }}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs text-gray-500">{t('filter.endDate')}</label>
                              <input
                                type="date"
                                value={filters.dateRange.end}
                                onChange={(e) => {
                                  let value = e.target.value;
                                  value = convertLocaleDateToISO(value);
                                  const validatedDate = validateDateInput(value);
                                  if (validatedDate !== value) {
                                    e.target.value = validatedDate;
                                  }
                                  handleFilterChange({
                                    ...filters,
                                    dateRange: { ...filters.dateRange, end: validatedDate }
                                  });
                                }}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <button
                              onClick={() => handleQuickDateSelect('thisMonth')}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                            >
                              {t('filter.thisMonth')}
                            </button>
                            <button
                              onClick={() => handleQuickDateSelect('lastMonth')}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                            >
                              {t('filter.lastMonth')}
                            </button>
                            <button
                              onClick={() => handleQuickDateSelect('last7days')}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                            >
                              {t('filter.last7days')}
                            </button>
                            <button
                              onClick={() => handleQuickDateSelect('last14days')}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                            >
                              {t('filter.last14days')}
                            </button>
                            <button
                              onClick={() => handleQuickDateSelect('last30days')}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                            >
                              {t('filter.last30days')}
                            </button>
                            <button
                              onClick={() => handleQuickDateSelect('last3Months')}
                              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                            >
                              {t('filter.last3Months')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 公司篩選器 */}
                <div className="space-y-2" ref={companyDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center space-x-1">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{t('filter.companies')}</span>
                    </span>
                  </label>
                  <div className="relative">
                  <button
                    type="button"
                      onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">
                          {filters.companies.length > 0 
                            ? t('filter.selectedCompanies', { count: filters.companies.length.toString() })
                            : t('filter.selectCompany')}
                      </span>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${showCompanyDropdown ? 'rotate-180' : ''}`} 
                           fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                    {showCompanyDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                        <div className="p-2">
                          {allCompanies.map(company => (
                            <div key={company} className="relative flex items-center">
                            <input
                                type="checkbox"
                                id={`company-${company}`}
                                checked={filters.companies.includes(company)}
                                onChange={() => {
                                  const newCompanies = filters.companies.includes(company)
                                    ? filters.companies.filter(c => c !== company)
                                    : [...filters.companies, company];
                                handleFilterChange({
                                  ...filters,
                                    companies: newCompanies
                                });
                              }}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <label
                                htmlFor={`company-${company}`}
                                className="ml-2 block w-full py-2 text-sm text-gray-900 cursor-pointer hover:bg-gray-50"
                              >
                                {company}
                              </label>
                        </div>
                          ))}
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>

              {/* 第二行：其他篩選條件 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* 裝置篩選 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center space-x-1">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span>{t('filter.devices')}</span>
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['iOS', 'Android'].map(device => (
                      <button
                        key={device}
                        onClick={() => {
                          const newDevices = filters.devices.includes(device)
                            ? filters.devices.filter(d => d !== device)
                            : [...filters.devices, device];
                          handleFilterChange({
                            ...filters,
                            devices: newDevices
                          });
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          filters.devices.includes(device)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {device}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 星等篩選 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center space-x-1">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span>{t('filter.ratings')}</span>
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[5, 4, 3, 2, 1].map(rating => (
                      <button
                        key={rating}
                        onClick={() => {
                          const newRatings = filters.ratings.includes(rating)
                            ? filters.ratings.filter(r => r !== rating)
                            : [...filters.ratings, rating];
                          handleFilterChange({
                            ...filters,
                            ratings: newRatings
                          });
                        }}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          filters.ratings.includes(rating)
                            ? 'bg-yellow-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {t(`filter.rating.${rating}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 情感篩選 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center space-x-1">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{t('filter.sentiment')}</span>
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'positive', bgColor: 'bg-green-600', hoverColor: 'hover:bg-green-700', lightBg: 'bg-green-100' },
                      { key: 'neutral', bgColor: 'bg-gray-600', hoverColor: 'hover:bg-gray-700', lightBg: 'bg-gray-100' },
                      { key: 'negative', bgColor: 'bg-red-600', hoverColor: 'hover:bg-red-700', lightBg: 'bg-red-100' }
                    ].map(({ key, bgColor, hoverColor, lightBg }) => (
                      <button
                        key={key}
                        onClick={() => {
                          const newSentiments = filters.sentiments.includes(key)
                            ? filters.sentiments.filter(s => s !== key)
                            : [...filters.sentiments, key];
                          handleFilterChange({
                            ...filters,
                            sentiments: newSentiments
                          });
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          filters.sentiments.includes(key)
                            ? `${bgColor} text-white ${hoverColor}`
                            : `${lightBg} text-gray-700 hover:bg-gray-200`
                        }`}
                      >
                        {t(`filter.sentiment.${key}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 分類篩選 */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center space-x-1">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>{t('filter.categories')}</span>
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map(category => (
                      <button
                        key={category}
                        onClick={() => {
                          const newCategories = filters.categories.includes(category)
                            ? filters.categories.filter(c => c !== category)
                            : [...filters.categories, category];
                          handleFilterChange({
                            ...filters,
                            categories: newCategories
                          });
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          filters.categories.includes(category)
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 已選擇的篩選條件標籤 */}
            <div className="mt-6 flex flex-wrap gap-2">
              {filters.devices.map(device => (
                <span key={device} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  <span>{t('filter.devices')}: {device}</span>
                  <button
                    onClick={() => handleFilterChange({
                      ...filters,
                      devices: filters.devices.filter(d => d !== device)
                    })}
                    className="ml-2 hover:text-blue-600"
                  >
                    ×
                  </button>
                </span>
              ))}
              {filters.ratings.map(rating => (
                <span key={rating} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                  <span>{t(`filter.rating.${rating}`)}</span>
                  <button
                    onClick={() => handleFilterChange({
                      ...filters,
                      ratings: filters.ratings.filter(r => r !== rating)
                    })}
                    className="ml-2 hover:text-yellow-600"
                  >
                    ×
                  </button>
                </span>
              ))}
              {filters.sentiments.map(sentiment => (
                <span key={sentiment} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                  <span>{t('filter.sentiment')}: {t(`filter.sentiment.${sentiment}`)}</span>
                  <button
                    onClick={() => handleFilterChange({
                      ...filters,
                      sentiments: filters.sentiments.filter(s => s !== sentiment)
                    })}
                    className="ml-2 hover:text-green-600"
                  >
                    ×
                  </button>
                </span>
              ))}
              {filters.categories.map(category => (
                <span key={category} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                  <span>{t('filter.categories')}: {category}</span>
                  <button
                    onClick={() => handleFilterChange({
                      ...filters,
                      categories: filters.categories.filter(c => c !== category)
                    })}
                    className="ml-2 hover:text-purple-600"
                  >
                    ×
                  </button>
                </span>
              ))}
              {filters.companies.map(company => (
                <span key={company} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800">
                  <span>{t('filter.companies')}: {company}</span>
                  <button
                    onClick={() => handleFilterChange({
                      ...filters,
                      companies: filters.companies.filter(c => c !== company)
                    })}
                    className="ml-2 hover:text-indigo-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </section>

          {/* 分析摘要和圖表區塊 */}
          <section id="analysis-report" className="grid grid-cols-1 gap-6">
            {/* 分析摘要 */}
            <div id="analysis-summary" className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">{t('analysis.summary.title')}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">{t('analysis.summary.totalReviews')}</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {analysisResult.summary.totalCount.toLocaleString()}
                  </p>
                  {analysisResult.summary.totalCount !== analysisResult.feedbacks.length && (
                    <p className="text-xs text-gray-500 mt-1">
                      共 {analysisResult.feedbacks.length.toLocaleString()} 筆
                    </p>
                  )}
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">{t('analysis.summary.positiveRatio')}</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {(analysisResult.summary.positiveRatio * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">{t('analysis.summary.neutralRatio')}</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {(analysisResult.summary.neutralRatio * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">{t('analysis.summary.negativeRatio')}</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {(analysisResult.summary.negativeRatio * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">{t('analysis.summary.averageRating')}</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {analysisResult.summary.averageRating.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            {/* 評論趨勢分析 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">{t('analysis.charts.monthlyTrend')}</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-[300px] sm:h-[400px]">
                  {analysisResult && <MonthlyTrendChart data={analysisResult.feedbacks} />}
                </div>
                <div className="h-[300px] sm:h-[400px]">
                  {analysisResult && <RatingDistributionChart data={analysisResult.feedbacks} />}
                </div>
              </div>
            </div>

            {/* 情感分析和分類統計 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">{t('analysis.sentiment')}</h2>
                <div className="h-[300px] sm:h-[400px]">
                  {analysisResult && <SentimentPieChart data={analysisResult.feedbacks} />}
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">{t('analysis.categories')}</h2>
                <div className="h-[300px] sm:h-[400px]">
                  {analysisResult && <CategoryBarChart data={analysisResult.feedbacks} />}
                </div>
              </div>
            </div>

            {/* 關鍵詞統計和評分分布 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">{t('analysis.keywords')}</h2>
                <div className="h-[300px] sm:h-[400px]">
                  {analysisResult && <KeywordsBarChart keywords={analysisResult.keywords} />}
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">{t('analysis.ratingDetails')}</h2>
                <div className="h-[300px] sm:h-[400px]">
                  <table className="w-full">
                    <thead className="border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">{t('analysis.table.rating')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">{t('analysis.table.reviewCount')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">{t('analysis.table.percentage')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Array.from({ length: 5 }, (_, i) => {
                        const rating = 5 - i;
                        const count = analysisResult.feedbacks.filter((f: AnalysisResult['feedbacks'][0]) => 
                          Math.floor(f.rating) === rating
                        ).length;
                        const percentage = (count / analysisResult.feedbacks.length * 100).toFixed(1);
                        
                        return (
                          <tr key={rating} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center">
                                <span className="mr-2">{rating}</span>
                                <svg 
                                  className="w-5 h-5 text-yellow-400" 
                                  fill="currentColor" 
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {count.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {percentage}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-gray-200">
                      <tr>
                        <td className="px-4 py-3 font-medium">{t('analysis.table.total')}</td>
                        <td className="px-4 py-3 font-medium">
                          {analysisResult.feedbacks.length.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-medium">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* 文字雲和 AI 分析區塊 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">{t('analysis.wordCloud')}</h2>
              
              {/* 調整文字雲容器高度和間距 */}
              <div className="mb-8">  {/* 添加底部間距 */}
                <div className="h-[300px] sm:h-[400px] w-full">
                  {analysisResult && <WordCloud keywords={analysisResult.keywords} />}
                </div>
              </div>

              {/* 將按鈕和分析結果移到文字雲下方 */}
              <div className="space-y-6">  {/* 使用 space-y-6 控制元素間距 */}
                <div className="flex justify-center">
                  <button
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center space-x-2 transition-colors disabled:opacity-50"
                    onClick={generateInsights}
                    disabled={isGeneratingInsights}
                  >
                    {isGeneratingInsights ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('analysis.generatingInsights')}
                      </>
                    ) : (
                      <>
                        <svg 
                          className="w-5 h-5" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth="2" 
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                          />
                        </svg>
                        {t('analysis.generateInsights')}
                      </>
                    )}
                  </button>
                </div>
                
                {/* AI 分析結果 */}
                {aiAnalysis && (
                  <div className="w-full bg-white rounded-lg p-6 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900">{t('analysis.insightsTitle')}</h3>
                    <div className="prose max-w-none whitespace-pre-wrap text-gray-700">
                      {aiAnalysis}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
