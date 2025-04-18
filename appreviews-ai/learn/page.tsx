'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function LearnCenter() {
  const { t } = useLanguage();
  const [expandedSections, setExpandedSections] = useState({
    analysis1: false,
    analysis2: false,
    scraper1: false,
    scraper2: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 mt-16">
      <h1 className="text-3xl font-bold mb-8 text-center sm:text-left">
        {t('learn.title')}
      </h1>
      
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 text-center sm:text-left">
          {t('learn.analysis.title')}
        </h2>
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <button 
              onClick={() => toggleSection('analysis1')}
              className="w-full p-4 sm:p-6 flex justify-between items-center hover:bg-gray-50"
            >
              <h3 className="text-lg sm:text-xl font-medium">
                {t('learn.analysis.section1.title')}
              </h3>
              {expandedSections.analysis1 ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>
            
            {expandedSections.analysis1 && (
              <div className="p-4 sm:p-6 pt-0 border-t">
                <div className="mb-6 bg-gray-50 p-2 rounded-lg">
                  <Image
                    src="/images/tutorial/analysis-dashboard.png"
                    alt={t('learn.images.analysis.dashboard') as string}
                    width={1200}
                    height={800}
                    className="rounded-lg w-full h-auto hover:scale-105 transition-transform duration-300 cursor-pointer"
                    priority
                  />
                </div>
                <ul className="list-disc list-outside ml-5 space-y-3 text-gray-600 text-sm sm:text-base">
                  {(t('learn.analysis.section1.steps') as string[]).map((step, index) => (
                    <li key={index} className="leading-relaxed">{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <button 
              onClick={() => toggleSection('analysis2')}
              className="w-full p-4 sm:p-6 flex justify-between items-center hover:bg-gray-50"
            >
              <h3 className="text-lg sm:text-xl font-medium">
                {t('learn.analysis.section2.title')}
              </h3>
              {expandedSections.analysis2 ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>
            
            {expandedSections.analysis2 && (
              <div className="p-4 sm:p-6 pt-0 border-t">
                <div className="mb-6 bg-gray-50 p-2 rounded-lg">
                  <Image
                    src="/images/tutorial/analysis-results.png"
                    alt={t('learn.images.analysis.results') as string}
                    width={1200}
                    height={800}
                    className="rounded-lg w-full h-auto hover:scale-105 transition-transform duration-300 cursor-pointer"
                  />
                </div>
                <ul className="list-disc list-outside ml-5 space-y-3 text-gray-600 text-sm sm:text-base">
                  {(t('learn.analysis.section2.steps') as string[]).map((step, index) => (
                    <li key={index} className="leading-relaxed">{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6 text-center sm:text-left">
          {t('learn.scraper.title')}
        </h2>
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <button 
              onClick={() => toggleSection('scraper1')}
              className="w-full p-4 sm:p-6 flex justify-between items-center hover:bg-gray-50"
            >
              <h3 className="text-lg sm:text-xl font-medium">
                {t('learn.scraper.section1.title')}
              </h3>
              {expandedSections.scraper1 ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>
            
            {expandedSections.scraper1 && (
              <div className="p-4 sm:p-6 pt-0 border-t">
                <div className="mb-6 bg-gray-50 p-2 rounded-lg">
                  <Image
                    src="/images/tutorial/scraper-setup.png"
                    alt={t('learn.images.scraper.setup') as string}
                    width={1200}
                    height={800}
                    className="rounded-lg w-full h-auto hover:scale-105 transition-transform duration-300 cursor-pointer"
                  />
                </div>
                <ul className="list-disc list-outside ml-5 space-y-3 text-gray-600 text-sm sm:text-base">
                  {(t('learn.scraper.section1.steps') as string[]).map((step, index) => (
                    <li key={index} className="leading-relaxed">{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <button 
              onClick={() => toggleSection('scraper2')}
              className="w-full p-4 sm:p-6 flex justify-between items-center hover:bg-gray-50"
            >
              <h3 className="text-lg sm:text-xl font-medium">
                {t('learn.scraper.section2.title')}
              </h3>
              {expandedSections.scraper2 ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>
            
            {expandedSections.scraper2 && (
              <div className="p-4 sm:p-6 pt-0 border-t">
                <div className="mb-6 bg-gray-50 p-2 rounded-lg">
                  <Image
                    src="/images/tutorial/scraper-results.png"
                    alt={t('learn.images.scraper.results') as string}
                    width={1200}
                    height={800}
                    className="rounded-lg w-full h-auto hover:scale-105 transition-transform duration-300 cursor-pointer"
                  />
                </div>
                <ul className="list-disc list-outside ml-5 space-y-3 text-gray-600 text-sm sm:text-base">
                  {(t('learn.scraper.section2.steps') as string[]).map((step, index) => (
                    <li key={index} className="leading-relaxed">{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
} 