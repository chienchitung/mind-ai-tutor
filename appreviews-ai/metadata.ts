import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AppReviews AI',
  description: '整合 Apple Store 與 Google Play 的評論數據，提供深入的用戶反饋分析',
  keywords: 'APP評論, 數據分析, 用戶反饋, Apple Store, Google Play',
  authors: [{ name: 'AppReviews AI團隊' }],
  robots: 'index, follow',
  icons: {
    icon: [
      { url: '/icon.svg' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: 'https://appreviewsai.me',
    title: 'AppReviews AI',
    description: '整合 Apple Store 與 Google Play 的評論數據，提供深入的用戶反饋分析',
    siteName: 'AppReviews AI'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}; 