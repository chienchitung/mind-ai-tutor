import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from './components/Navbar';
import Chatbot from './components/Chatbot';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import Footer from './components/Footer';
import { metadata, viewport } from './metadata';

// 配置字體
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export { metadata, viewport };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className={inter.className}>
      <head>
        <meta name="viewport" content={`${viewport.width}, ${viewport.initialScale}, ${viewport.maximumScale}`} />
      </head>
      <body className="h-full">
        <LanguageProvider>
          <AuthProvider>
            <div className="min-h-full flex flex-col">
              <Navbar />
              <div className="flex-grow">
                {children}
              </div>
              <Footer />
            </div>
            <Chatbot />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
