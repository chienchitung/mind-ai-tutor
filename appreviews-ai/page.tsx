'use client';

import { useState, useRef } from 'react';
import type { AnalysisResult } from '@/types/feedback';
import Image from "next/image";
import { motion } from 'framer-motion';
import { useLanguage } from './contexts/LanguageContext';

// 修正圖表組件的引入路徑
import { SentimentPieChart } from './components/charts/SentimentPieChart';
import { KeywordsBarChart } from './components/charts/KeywordsBarChart';
import { WordCloud } from './components/charts/WordCloud';
import { MonthlyTrendChart, RatingDistributionChart } from './components/charts/TrendChart';
import { CategoryBarChart } from './components/charts/CategoryBarChart';

// 自定義 Logo SVG 組件 - AI 字樣
const LogoSVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <g transform="scale(0.213333)">
      <rect width="150" height="150" fill="#F9F9F9"/>    
      <path d="M96.1375 51.2609C101.308 50.3007 104.299 47.2723 105.149 42.1759C105.684 47.0877 109.432 50.633 114.086 51.2239C108.971 52.1657 105.961 55.1755 105.112 60.3273C104.853 57.9822 103.93 55.9141 102.268 54.2153C100.569 52.5165 98.5195 51.5563 96.1375 51.2609Z" fill="currentColor"/>
      <path d="M37.3222 78.0925C59.6985 73.9369 72.6448 60.8307 76.3209 38.7741C78.6385 60.0316 94.8613 75.3753 115 77.9326C92.8634 82.0083 79.8372 95.0345 76.1611 117.331C75.0423 107.182 71.0465 98.2312 63.8541 90.8789C56.5019 83.5267 47.6313 79.3711 37.3222 78.0925Z" fill="currentColor"/>
      <path d="M35 44.7824C41.8937 43.5022 45.8822 39.4644 47.0148 32.6692C47.7288 39.2182 52.7267 43.9453 58.931 44.7332C52.1112 45.9888 48.0981 50.002 46.9655 56.8711C46.6208 53.7443 45.3898 50.9868 43.174 48.7217C40.9089 46.4566 38.176 45.1764 35 44.7824Z" fill="currentColor"/>
    </g>
  </svg>
);

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative bg-white overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl tracking-tight font-bold text-gray-900 sm:text-5xl md:text-6xl pb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-green-500">
              {t('home.hero.title')}
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              {t('home.hero.subtitle')}
            </p>
          </div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="py-16 bg-gray-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              {t('home.features.title')}
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* 自動化爬取 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-white rounded-lg shadow-lg overflow-hidden"
            >
              <div className="px-6 py-8">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <h3 className="mt-6 text-center text-lg font-medium text-gray-900">
                  {t('home.features.autoScraping.title')}
                </h3>
                <p className="mt-4 text-center text-gray-500">
                  {t('home.features.autoScraping.desc')}
                </p>
              </div>
            </motion.div>

            {/* AI 分析 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-white rounded-lg shadow-lg overflow-hidden"
            >
              <div className="px-6 py-8">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="mt-6 text-center text-lg font-medium text-gray-900">
                  {t('home.features.aiAnalysis.title')}
                </h3>
                <p className="mt-4 text-center text-gray-500">
                  {t('home.features.aiAnalysis.desc')}
                </p>
              </div>
            </motion.div>

            {/* 視覺化報表 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="bg-white rounded-lg shadow-lg overflow-hidden"
            >
              <div className="px-6 py-8">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                </div>
                <h3 className="mt-6 text-center text-lg font-medium text-gray-900">
                  {t('home.features.visualization.title')}
                </h3>
                <p className="mt-4 text-center text-gray-500">
                  {t('home.features.visualization.desc')}
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* How it works Section */}
      <motion.section 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="py-16 bg-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              {t('home.howItWorks.title')}
            </h2>
          </div>

          <div className="mt-12">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-center"
              >
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                  <span className="text-lg font-bold">1</span>
                </div>
                <h3 className="mt-6 text-lg font-medium text-gray-900">
                  {t('home.howItWorks.step1.title')}
                </h3>
                <p className="mt-2 text-base text-gray-500">
                  {t('home.howItWorks.step1.desc')}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="text-center"
              >
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                  <span className="text-lg font-bold">2</span>
                </div>
                <h3 className="mt-6 text-lg font-medium text-gray-900">
                  {t('home.howItWorks.step2.title')}
                </h3>
                <p className="mt-2 text-base text-gray-500">
                  {t('home.howItWorks.step2.desc')}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="text-center"
              >
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                  <span className="text-lg font-bold">3</span>
                </div>
                <h3 className="mt-6 text-lg font-medium text-gray-900">
                  {t('home.howItWorks.step3.title')}
                </h3>
                <p className="mt-2 text-base text-gray-500">
                  {t('home.howItWorks.step3.desc')}
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section 
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-blue-600"
      >
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            <span className="block">{t('home.cta.title')}</span>
            <span className="block text-blue-200">{t('home.cta.subtitle')}</span>
          </h2>
          <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
            <div className="inline-flex rounded-md shadow">
              <a
                href="/scraper"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50"
              >
                {t('home.cta.button')}
              </a>
            </div>
          </div>
        </div>
      </motion.section>
    </main>
  );
}
