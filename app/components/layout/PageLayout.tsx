'use client';

import React, { useEffect, useState, useCallback } from "react";
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

  // 使用 useCallback 優化檢測行動裝置的函數
  const checkMobile = useCallback(() => {
    if (typeof window !== 'undefined') {
      const isMobileView = window.innerWidth < 768;
      setIsMobile(isMobileView);
      if (isMobileView) {
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  // 統一的 resize 事件處理
  useEffect(() => {
    // 初始檢查
    checkMobile();

    // 只添加一個 resize 事件監聽器
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkMobile);
      
      // 清理函數
      return () => {
        window.removeEventListener('resize', checkMobile);
      };
    }
  }, [checkMobile]);

  const hasDedicatedLayout = pathname.startsWith('/dashboard') ||
    pathname.startsWith('/students') ||
    pathname.startsWith('/lessons') ||
    pathname.startsWith('/activities') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings');

  const handleSidebarCollapse = (collapsed: boolean) => {
    // 在行動裝置上強制保持折疊狀態
    if (!isMobile) {
      setIsSidebarCollapsed(collapsed);
    }
  };

  const sidebarWidth = isMobile ? 0 : (isSidebarCollapsed ? 70 : 256);

  if (hasDedicatedLayout) {
    return <>{children}</>;
  }

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-background">
        {/* 在非行動裝置時才渲染側邊欄 */}
        {!isMobile && (
          <Sidebar
            className={isSidebarCollapsed ? 'w-[70px]' : 'w-64'}
            onCollapseChange={handleSidebarCollapse}
          />
        )}

        <main
          style={{
            marginLeft: isMobile ? '0' : `${sidebarWidth}px`,
            transition: 'margin-left 0.3s ease-in-out',
            width: isMobile ? '100%' : `calc(100% - ${sidebarWidth}px)`
          }}
          className="h-full flex-1"
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