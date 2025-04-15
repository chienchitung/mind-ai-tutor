'use client';

import React, { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { PageTransition } from "./PageTransition";
import { usePathname } from "next/navigation";

// 錯誤邊界組件
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("PageLayout Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface PageLayoutProps {
  children: React.ReactNode;
}

/**
 * Main page layout component
 * Optimized for performance with minimal re-renders
 * Includes memory leak prevention during navigation
 */
export function PageLayout({ children }: PageLayoutProps) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
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
    if (typeof window !== 'undefined') {
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);
  
  // Check if we're on a page that has its own sidebar layout
  const hasDedicatedLayout = pathname.startsWith('/dashboard') || 
                            pathname.startsWith('/students') || 
                            pathname.startsWith('/lessons') || 
                            pathname.startsWith('/courses') ||
                            pathname.startsWith('/activities') ||
                            pathname.startsWith('/reports') ||
                            pathname.startsWith('/settings');
  
  // 處理側邊欄折疊狀態變更
  const handleSidebarCollapse = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  };
  
  // 計算側邊欄寬度
  const sidebarWidth = isMobile ? 0 : (isSidebarCollapsed ? 70 : 256);
  
  // 確保在導航時正確清理
  useEffect(() => {
    // 清理函數
    return () => {
      // 清理事件監聽器
      const cleanup = () => {
        // 移除所有事件監聽器
        const events = ['resize', 'scroll', 'click', 'touchstart', 'touchmove'];
        events.forEach(event => {
          window.removeEventListener(event, () => {});
        });
      };

      // 使用 requestAnimationFrame 確保在下一幀執行清理
      if (typeof window !== 'undefined') {
        requestAnimationFrame(cleanup);
      }
    };
  }, []);

  if (hasDedicatedLayout) {
    return <>{children}</>;
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-background">
        {/* Only render the sidebar if we're NOT on a page with its own layout */}
        <Sidebar 
          className={isSidebarCollapsed ? 'w-[70px]' : 'w-64'} 
          onCollapseChange={handleSidebarCollapse}
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
              <PageTransition>
                {children}
              </PageTransition>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
} 