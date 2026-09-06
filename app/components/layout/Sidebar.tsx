'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  ChevronLeft,
  Gamepad2,
  LayoutDashboard,
  MessageSquare,
  PanelLeft,
  Radio,
  ShieldCheck,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { BrandLogo } from './BrandLogo';
import { AccountMenu } from './AccountMenu';

interface SidebarProps {
  className?: string;
  onCollapseChange?: (collapsed: boolean) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  user: User | null;
  isAdmin: boolean;
}

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

// user/isAdmin are fetched once by AppLayout and passed down as props
// (see its own module-level cache, which avoids the "系統管理" nav item
// flashing away and back on every navigation) - shared with AppTopbar's
// mobile account menu so mounting both doesn't double the Supabase round trip.
export function Sidebar({
  className,
  onCollapseChange,
  isOpen = false,
  onOpenChange,
  user,
  isAdmin,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const pathname = usePathname();

  useEffect(() => {
    setIsCollapsed(className?.includes('w-[70px]') ?? false);
  }, [className]);

  const navigation = useMemo<NavGroup[]>(() => {
    const groups: NavGroup[] = [
      {
        items: [{ name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard }],
      },
      {
        label: language === 'zh-TW' ? '教學管理' : 'Teaching',
        items: [
          { name: t('students'), href: '/students', icon: Users },
          { name: t('lessons'), href: '/lessons', icon: BookOpen },
          { name: t('digital_games'), href: '/digital-games', icon: Gamepad2 },
          { name: t('ai_quiz'), href: '/ai-quiz', icon: Wand2 },
          { name: t('live_session'), href: '/live/sessions', icon: Radio },
        ],
      },
      {
        label: language === 'zh-TW' ? '互動溝通' : 'Engagement',
        items: [
          { name: t('activities'), href: '/activities', icon: Bell },
          { name: t('feedback'), href: '/feedback', icon: MessageSquare },
          { name: t('events'), href: '/events', icon: Calendar },
        ],
      },
      {
        label: language === 'zh-TW' ? '數據分析' : 'Insights',
        items: [{ name: t('reports'), href: '/reports', icon: BarChart3 }],
      },
    ];

    if (isAdmin) {
      groups.push({
        label: language === 'zh-TW' ? '系統' : 'System',
        items: [{
          name: language === 'zh-TW' ? '系統管理' : 'Administration',
          href: '/admin',
          icon: ShieldCheck,
        }],
      });
    }

    return groups;
  }, [isAdmin, language, t]);

  const handleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onCollapseChange?.(next);
  };

  return (
    <>
      <aside
        className={cn(
          // inset-y-0 alone already stretches this fixed element to the real
          // visible viewport. Adding h-screen (height: 100vh) on top of that
          // is redundant on desktop but actively wrong on mobile Safari:
          // 100vh is measured against the toolbar-collapsed viewport, taller
          // than what's visible while the address bar is showing, so the
          // account/Settings section at the bottom of this drawer rendered
          // below the visible fold with no way to scroll to it.
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border/80 bg-card transition-[width,transform] duration-300',
          isCollapsed ? 'w-[70px]' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          className,
        )}
        data-tour="sidebar"
      >
        <div className={cn('flex h-16 items-center border-b border-border/70 px-3', isCollapsed ? 'justify-center' : 'justify-between')}>
          {!isCollapsed && (
            <Link href="/dashboard" className="flex min-w-0 flex-1 items-center" aria-label="MindAiTutor">
              <BrandLogo />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="hidden shrink-0 md:inline-flex"
            onClick={handleCollapse}
            aria-label={isCollapsed ? t('expand_sidebar') : t('collapse_sidebar')}
          >
            {isCollapsed ? <PanelLeft className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto shrink-0 md:hidden"
            onClick={() => onOpenChange?.(false)}
            aria-label={language === 'zh-TW' ? '關閉導覽選單' : 'Close navigation'}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <nav className="space-y-5 p-3 py-4">
            {navigation.map((group, groupIndex) => (
              <div key={group.label || groupIndex}>
                {group.label && !isCollapsed && (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {group.label}
                  </p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    // The live-session item links to /live/sessions, but the
                    // whole /live/* flow (creating one, the presenter
                    // workspace) belongs to it too - a plain prefix match on
                    // its own href would miss /live/new and /live/[id]/present.
                    const active = item.href === '/live/sessions'
                      ? pathname.startsWith('/live')
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => onOpenChange?.(false)}
                        title={isCollapsed ? item.name : undefined}
                        className={cn(
                          'group flex h-10 items-center rounded-xl px-3 text-sm font-medium transition-colors',
                          active
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          isCollapsed && 'justify-center px-0',
                        )}
                      >
                        <item.icon className={cn('h-[18px] w-[18px] shrink-0', !isCollapsed && 'mr-3')} />
                        {!isCollapsed && <span className="truncate">{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Hidden on mobile - the account menu lives in AppTopbar's
            top-right corner there instead (see its own comment). Desktop
            keeps it here at the bottom of the persistent sidebar. The
            "icon" variant's trigger isn't full-width like "row"'s is, so
            centering it when collapsed needs a flex wrapper rather than
            relying on the (inline-flex) button's own auto margins. */}
        <div className={cn('hidden border-t border-border/70 p-3 md:block', isCollapsed && 'md:flex md:justify-center')}>
          <AccountMenu user={user} variant={isCollapsed ? 'icon' : 'row'} />
        </div>
      </aside>

      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px] md:hidden"
          onClick={() => onOpenChange?.(false)}
          aria-label={language === 'zh-TW' ? '關閉導覽選單' : 'Close navigation'}
        />
      )}
    </>
  );
}
