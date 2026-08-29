'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageTransition } from '@/components/layout/PageTransition';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // 檢查身份驗證狀態
    const checkAuth = async () => {
      try {
        const { createClient } = await import('@/app/lib/supabase');
        const supabase = createClient();
        
        // 檢查會話
        const { data: { session } } = await supabase.auth.getSession();
        
        // If session exists, we're authenticated
        if (session) {
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }
        
        // Fallback to getUser method
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log('No authenticated user found, redirecting to login');
          toast({
            title: t('authentication_required'),
            description: t('please_sign_in_to_access_page'),
            variant: 'destructive',
          });
          router.push('/login');
          return;
        }
        
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error checking authentication:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, toast]);

  // 檢測客戶端螢幕尺寸
  useEffect(() => {
    const checkMobile = () => {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      if (isMobileView) {
        setIsSidebarCollapsed(true);
      }
    };
    
    // 初始檢查
    checkMobile();
    
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSidebarCollapse = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Don't render anything while redirecting
  }

  // 計算側邊欄寬度
  const sidebarWidth = isMobile ? 0 : (isSidebarCollapsed ? 70 : 256);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar 
        className={isSidebarCollapsed ? 'w-[70px]' : 'w-64'} 
        onCollapseChange={handleSidebarCollapse}
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
      />
      
      <main 
        style={{ 
          marginLeft: isMobile ? '0' : `${sidebarWidth}px`,
          transition: 'margin-left 0.3s ease-in-out',
          width: `calc(100% - ${sidebarWidth}px)`
        }}
        className="h-full"
      >
        <div className="h-full overflow-auto">
          <div className="mx-auto px-4 md:px-6 py-4 pb-8 max-w-7xl">
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
      </main>

      {/* 移動端菜單按鈕 */}
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <Button 
          variant="ghost" 
          size="sm" 
          className="bg-white rounded-md shadow-sm" 
          onClick={toggleMenu}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
} 