'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gamepad2,
  Globe,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeft,
  Radio,
  Settings,
  ShieldCheck,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage, type Language } from '@/app/contexts/LanguageContext';
import { useTranslation, translations } from '@/utils/translations';
import { confirmAppNavigation } from '@/lib/navigation-guard';
import { BrandLogo } from './BrandLogo';

interface SidebarProps {
  className?: string;
  onCollapseChange?: (collapsed: boolean) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
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

export function Sidebar({
  className,
  onCollapseChange,
  isOpen = false,
  onOpenChange,
}: SidebarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation(language);
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setIsCollapsed(className?.includes('w-[70px]') ?? false);
  }, [className]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { supabase } = await import('../../../lib/supabase');
        const client = supabase();
        const { data: { user: currentUser } } = await client.auth.getUser();
        setUser(currentUser);
        if (currentUser) {
          const { data: profile } = await client
            .from('profiles')
            .select('role')
            .eq('user_id', currentUser.id)
            .maybeSingle();
          setIsAdmin(profile?.role === 'admin');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    loadUser();
  }, []);

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

  const handleSignOut = async () => {
    if (!confirmAppNavigation()) return;
    try {
      const { supabase } = await import('../../../lib/supabase');
      await supabase().auth.signOut();
      toast({
        title: t('signed_out_successfully'),
        description: t('signed_out_description'),
      });
      window.location.href = '/login';
    } catch {
      toast({
        title: t('error_signing_out'),
        description: t('error_signing_out_description'),
        variant: 'destructive',
      });
    }
  };

  const changeLanguage = (value: Language) => {
    setLanguage(value);
    toast({
      title: translations[value].language_changed,
      description: translations[value].language_changed_description,
    });
  };

  const displayName = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || (language === 'zh-TW' ? '使用者' : 'User');
  const initials = displayName.slice(0, 2).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-border/80 bg-card transition-[width,transform] duration-300',
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

        <div className="border-t border-border/70 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn('h-auto w-full rounded-xl p-2', isCollapsed ? 'justify-center' : 'justify-start')}
              >
                <Avatar className={cn('h-9 w-9 shrink-0', !isCollapsed && 'mr-3')}>
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-muted text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">{displayName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{user?.email || t('free_plan')}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => { if (confirmAppNavigation()) router.push('/settings'); }}>
                  <Settings className="mr-2 h-4 w-4" />
                  {t('settings')}
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Globe className="mr-2 h-4 w-4" />
                    {t('language')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup value={language} onValueChange={(value) => changeLanguage(value as Language)}>
                      <DropdownMenuRadioItem value="en">English {language === 'en' && <Check className="ml-auto h-4 w-4" />}</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="zh-TW">繁體中文 {language === 'zh-TW' && <Check className="ml-auto h-4 w-4" />}</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={() => { if (confirmAppNavigation()) router.push('/subscription'); }}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t('subscription')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('log_out')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
