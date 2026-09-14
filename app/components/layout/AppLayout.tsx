'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageTransition } from '@/components/layout/PageTransition';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { AppTopbar } from '@/components/layout/AppTopbar';

interface AppLayoutProps {
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

// Keep the last account snapshot for the uncommon transition from a public
// route back into the protected shell. Navigation inside the admin area keeps
// this component mounted, so it does not need another Supabase round trip.
let cachedUser: User | null = null;
let cachedIsAdmin = false;

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [user, setUser] = useState<User | null>(cachedUser);
  const [isAdmin, setIsAdmin] = useState(cachedIsAdmin);
  const { toast } = useToast();

  // Fetched once here (rather than separately in both Sidebar and
  // AppTopbar, which both need it for the account menu) so mounting the
  // account menu in two places doesn't double the Supabase round trip.
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const client = supabase();
        const { data: { user: currentUser } } = await client.auth.getUser();
        setUser(currentUser);
        cachedUser = currentUser;
        if (currentUser) {
          const { data: profile } = await client
            .from('profiles')
            .select('role')
            .eq('user_id', currentUser.id)
            .maybeSingle();
          const admin = profile?.role === 'admin';
          setIsAdmin(admin);
          cachedIsAdmin = admin;
        } else {
          setIsAdmin(false);
          cachedIsAdmin = false;
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    loadUser();
  }, []);

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

  // Restore the preference after hydration so the server and first client
  // render match. The persistent shell then preserves it between sections.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') setIsSidebarCollapsed(true);
    } catch {
      // Best-effort - localStorage can be unavailable (private browsing, disabled).
    }
  }, []);

  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  const handleSidebarCollapse = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // Best-effort - the toggle itself still works even if persisting it fails.
    }
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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        className={!isMobile && isSidebarCollapsed ? 'w-[70px]' : 'w-64'}
        onCollapseChange={handleSidebarCollapse}
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
        user={user}
        isAdmin={isAdmin}
      />

      <main
        style={{
          marginLeft: isMobile ? '0' : `${sidebarWidth}px`,
          transition: 'margin-left 0.3s ease-in-out',
          width: `calc(100% - ${sidebarWidth}px)`
        }}
        className="h-full min-w-0"
      >
        <div ref={contentScrollRef} className="h-full overflow-auto">
          <AppTopbar onOpenMenu={() => setIsMenuOpen(true)} user={user} />
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-10 md:px-8 md:py-8">
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
      </main>
    </div>
  );
}
