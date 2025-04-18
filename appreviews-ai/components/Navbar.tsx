'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, Globe, LogOut, User } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import Image from 'next/image';

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

const productCategories = [
  { title: 'features.dataScraping', link: '/scraper' },
  { title: 'features.reviewAnalysis', link: '/analysis' },
  { title: 'features.competitorAnalysis', link: '/competitor-analysis' },
  { title: 'nav.pricing', link: '/pricing' },
  { title: 'nav.learningCenter', link: '/learn' },
];

interface NavbarProps {
  // 如果需要props可以在這裡定義
}

// 定義事件類型
type MouseEventType = MouseEvent & {
  target: HTMLElement;
}

export default function Navbar({}: NavbarProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();

  useEffect(() => {
    function handleClickOutside(event: MouseEventType) {
      if (
        (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) &&
        (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node))
      ) {
        setDropdownOpen(false);
        setUserDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside as EventListener);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside as EventListener);
    };
  }, []);

  return (
    <>
      {/* Sidebar Overlay */}
      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-[80vw] sm:w-[385px] bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-[101] ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            <span className="text-lg font-semibold">{t('nav.menu')}</span>
            <button 
              onClick={() => setMenuOpen(false)} 
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          </div>
          
          <nav className="flex-1 px-4 py-6">
            <ul className="space-y-4">
              {productCategories.map((category, index) => (
                <li key={index}>
                  <Link 
                    href={category.link} 
                    className={`flex items-center py-3 px-4 text-lg text-gray-700 hover:bg-gray-100 rounded-md ${
                      pathname === category.link 
                        ? 'font-bold bg-gray-50' 
                        : 'font-medium'
                    }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t(category.title)}
                  </Link>
                </li>
              ))}
              
              <li className="pt-4 border-t">
                {user ? (
                  <button
                    onClick={() => {
                      signOut();
                      setMenuOpen(false);
                    }}
                    className="flex items-center py-3 px-4 text-lg text-gray-700 hover:bg-gray-100 rounded-md font-medium w-full"
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    {t('nav.logout')}
                  </button>
                ) : (
                  <Link 
                    href="/login"
                    className="flex items-center py-3 px-4 text-lg text-gray-700 hover:bg-gray-100 rounded-md font-medium"
                    onClick={() => setMenuOpen(false)}
                  >
                    {t('nav.login')}
                  </Link>
                )}
              </li>
              <li>
                <Link 
                  href="/scraper"
                  className="flex items-center py-3 px-4 text-lg text-white bg-[#0066FF] hover:bg-[#0052CC] rounded-md font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('nav.startFree')}
                </Link>
              </li>
              <li className="pt-4 border-t">
                <button
                  onClick={() => {
                    setLanguage(language === 'zh' ? 'en' : 'zh');
                    setMenuOpen(false);
                  }}
                  className="flex items-center py-3 px-4 text-lg text-gray-700 hover:bg-gray-100 rounded-md font-medium w-full"
                >
                  <Globe className="h-5 w-5 mr-2" />
                  <span>{language === 'zh' ? 'English' : '中文'}</span>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <nav className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            {/* Logo 和導航項目容器 */}
            <div className="flex items-center flex-shrink-0">
              <Link href="/" className="flex items-center space-x-2 mr-8">
                <LogoSVG />
                <span className="text-xl font-bold whitespace-nowrap">
                  AppReviews AI
                </span>
              </Link>

              <div className="hidden md:flex items-center space-x-1">
                <div
                  className="relative"
                  ref={dropdownRef}
                >
                  <button 
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center whitespace-nowrap"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    onMouseEnter={() => setDropdownOpen(true)}
                  >
                    {t('nav.features')}
                    {dropdownOpen ? (
                      <ChevronUp className="ml-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </button>
                  {dropdownOpen && (
                    <div
                      className="absolute left-0 mt-2 w-72 bg-white border border-gray-200 rounded-md shadow-lg p-4"
                      onMouseLeave={() => setDropdownOpen(false)}
                    >
                      <Link
                        href="/scraper"
                        className="block px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-md"
                      >
                        {t('features.dataScraping')}
                        <p className="text-xs text-gray-500 font-normal">{t('features.dataScraping.desc')}</p>
                      </Link>
                      <Link
                        href="/analysis"
                        className="block px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-md mt-2"
                      >
                        {t('features.reviewAnalysis')}
                        <p className="text-xs text-gray-500 font-normal">{t('features.reviewAnalysis.desc')}</p>
                      </Link>
                      <Link
                        href="/competitor-analysis"
                        className="block px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-md mt-2"
                      >
                        {t('features.competitorAnalysis')}
                        <p className="text-xs text-gray-500 font-normal">{t('features.competitorAnalysis.desc')}</p>
                      </Link>
                    </div>
                  )}
                </div>

                <Link 
                  href="/pricing" 
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                >
                  {t('nav.pricing')}
                </Link>
                <Link 
                  href="/learn" 
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 whitespace-nowrap"
                >
                  {t('nav.learningCenter')}
                </Link>
              </div>
            </div>

            {/* 右側按鈕組 */}
            <div className="flex items-center space-x-2">
              <div className="hidden md:flex items-center space-x-2">
                {/* 語言切換按鈕 */}
                <button
                  onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                  className="flex items-center space-x-1 px-2 py-1 text-gray-700 hover:text-gray-900 rounded-md hover:bg-gray-100"
                >
                  <Globe className="h-4 w-4" />
                  <span className="text-sm font-medium">{language.toUpperCase()}</span>
                </button>
                
                {user ? (
                  <div className="relative" ref={userDropdownRef}>
                    <button
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      className="flex items-center space-x-1 text-gray-700 hover:text-gray-900"
                    >
                      {user.user_metadata?.avatar_url ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden">
                          <Image
                            src={user.user_metadata.avatar_url}
                            alt="User Profile"
                            width={32}
                            height={32}
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                      )}
                    </button>
                    
                    {userDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg p-2">
                        <div className="px-4 py-3 text-sm border-b border-gray-100">
                          <div className="font-medium text-gray-900">
                            {user.user_metadata?.name || user.user_metadata?.full_name || '使用者'}
                          </div>
                          <div className="text-gray-500 truncate">
                            {user.email}
                          </div>
                        </div>
                        <Link 
                          href="/account-settings"
                          className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md mt-1 flex items-center"
                        >
                          <span>{t('nav.accountSettings')}</span>
                        </Link>
                        <button
                          onClick={() => {
                            signOut();
                            setUserDropdownOpen(false);
                          }}
                          className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md mt-1 flex items-center justify-between"
                        >
                          <span>{t('nav.logout')}</span>
                          <LogOut className="h-4 w-4 ml-2" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link 
                    href="/login" 
                    className="px-3 py-2 text-gray-700 hover:text-gray-900 text-sm font-medium whitespace-nowrap"
                  >
                    {t('nav.login')}
                  </Link>
                )}
                
                <Link 
                  href="/scraper"
                  className="px-4 py-2 rounded-lg bg-[#0066FF] hover:bg-[#0052CC] text-white text-sm font-medium transition-colors duration-200 whitespace-nowrap"
                >
                  {t('nav.startFree')}
                </Link>
              </div>

              <button
                onClick={() => setMenuOpen(true)}
                className="md:hidden p-2 rounded-md hover:bg-gray-100"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 6h16M4 12h16M4 18h16" 
                  />
                </svg>
              </button>
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}