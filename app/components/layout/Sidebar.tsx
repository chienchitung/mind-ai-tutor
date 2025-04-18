'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Gamepad2,
  GraduationCap,
  Play,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Globe,
  CreditCard,
  User,
  ChevronRight as ChevronRightIcon,
  Check,
  Calendar,
  MessageSquare,
  Bell,
  Wand2,
  PanelLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';

interface SidebarProps {
  className?: string;
  onCollapseChange?: (collapsed: boolean) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Sidebar({ 
  className, 
  onCollapseChange,
  isOpen = false,
  onOpenChange
}: SidebarProps) {
  const [user, setUser] = useState<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [language, setLanguage] = useState<string>("en");
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  // 檢測客戶端螢幕尺寸
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 監聽外部傳入的 className 中是否包含 width 信息
  useEffect(() => {
    if (className) {
      const isNarrow = className.includes('w-[70px]');
      if (isCollapsed !== isNarrow) {
        setIsCollapsed(isNarrow);
      }
    }
  }, [className, isCollapsed]);

  useEffect(() => {
    const getUser = async () => {
      try {
        // 動態導入 supabase 函數以避免服務器端渲染問題
        const { supabase } = await import('../../../lib/supabase');
        const supabaseClient = supabase();
        const { data: { user } } = await supabaseClient.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    getUser();
  }, []);

  const handleSignOut = async () => {
    try {
      // 動態導入 supabase 函數以避免服務器端渲染問題
      const { supabase } = await import('../../../lib/supabase');
      const supabaseClient = supabase();
      await supabaseClient.auth.signOut();
      toast({
        title: 'Signed out successfully',
        description: 'You have been signed out of your account.',
      });
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      toast({
        title: 'Error signing out',
        description: 'There was a problem signing out of your account.',
        variant: 'destructive',
      });
    }
  };

  const handleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    if (onCollapseChange) {
      onCollapseChange(newCollapsedState);
    }
  };

  // 當點擊導航項目時關閉移動端菜單
  const handleNavClick = () => {
    if (isMobile && onOpenChange) {
      onOpenChange(false);
    }
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  const changeLanguage = (value: string) => {
    setLanguage(value);
    toast({
      title: value === 'en' ? 'Language changed' : '語言已更改',
      description: value === 'en' ? 'English is now active' : '繁體中文現在已啟用',
    });
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Students',
      href: '/students',
      icon: Users,
    },
    {
      name: 'Activities',
      href: '/activities',
      icon: Bell,
    },
    {
      name: 'Lessons',
      href: '/lessons',
      icon: BookOpen,
    },
    {
      name: 'Digital Games',
      href: '/digital-games',
      icon: Gamepad2,
    },
    {
      name: 'AI Quiz',
      href: '/ai-quiz',
      icon: Wand2,
    },
    {
      name: 'Feedback',
      href: '/feedback',
      icon: MessageSquare,
    },
    {
      name: 'Events',
      href: '/events',
      icon: Calendar,
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: BarChart3,
    },
  ];

  return (
    <>
      <aside 
        className={cn(
          'fixed inset-y-0 left-0 z-30 bg-white border-r border-gray-200 transition-all duration-300 ease-in-out h-screen',
          isCollapsed ? 'w-[70px]' : 'w-64',
          {
            'hidden md:block': isMobile && !isCollapsed && !isOpen,
            'block': isMobile && isOpen,
          },
          className
        )}
        data-tour="sidebar"
      >
        {/* Logo and toggle button */}
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <Link href="/" className={cn(
            "flex items-center overflow-hidden transition-all duration-300",
            isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto"
          )}>
            <span className="text-xl font-bold whitespace-nowrap">MindAiTutor</span>
          </Link>

          {isCollapsed ? (
            // When collapsed, use same styling as nav icons exactly
            <div 
              className="flex items-center justify-center p-2 rounded-md cursor-pointer text-gray-600 hover:bg-gray-100 hover:text-gray-900 mx-auto"
              onClick={handleCollapse}
              aria-label="Expand sidebar"
            >
              <PanelLeft className="h-5 w-5 text-gray-500" />
            </div>
          ) : (
            // When expanded
            <div 
              className="flex items-center px-3 py-2.5 rounded-md cursor-pointer text-gray-600 hover:bg-gray-100 hover:text-gray-900 ml-auto"
              onClick={handleCollapse}
              aria-label="Collapse sidebar"
            >
              <PanelLeft className="h-5 w-5 text-gray-500" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 h-[calc(100vh-8rem)]">
          <nav className="space-y-1 p-3">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    'flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    isCollapsed && 'justify-center p-2'
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon
                    className={cn(
                      'h-5 w-5 flex-shrink-0',
                      isCollapsed ? 'mr-0' : 'mr-3',
                      isActive 
                        ? 'text-blue-700' 
                        : 'text-gray-500'
                    )}
                  />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User avatar and dropdown */}
        <div className="border-t p-4 flex items-center shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center w-full">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center w-full px-0 justify-start"
                  >
                    <Avatar className="h-9 w-9 mr-3">
                      {user && user.app_metadata?.provider === 'google' && (user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                        <AvatarImage src={user.user_metadata?.avatar_url || user.user_metadata?.picture} alt="User" />
                      ) : (
                        <AvatarFallback className="bg-gray-200 text-gray-700">
                          {user?.user_metadata?.full_name 
                            ? `${user.user_metadata.full_name.split(' ')[0][0]}${user.user_metadata.full_name.split(' ')[1]?.[0] || ''}`
                            : typeof user?.email === 'string' 
                              ? user.email.charAt(0).toUpperCase() 
                              : 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    
                    <div className="flex flex-col text-sm text-left">
                      <span className="font-medium text-gray-900">
                        {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {user?.user_metadata?.subscription_plan || 'Free plan'}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.email}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.user_metadata?.subscription_plan || 'Free plan'}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => handleNavigate('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Globe className="mr-2 h-4 w-4" />
                        <span>Language</span>
                        <span className="ml-auto text-xs rounded-full bg-muted px-2 py-0.5">BETA</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={language} onValueChange={changeLanguage}>
                          <DropdownMenuRadioItem value="en">
                            English
                            {language === "en" && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="zh-TW">
                            繁體中文
                            {language === "zh-TW" && <Check className="ml-auto h-4 w-4" />}
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuItem onClick={() => handleNavigate('/subscription')}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>Subscription</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-9 w-9"
                >
                  {user ? (
                    <Avatar className="h-full w-full">
                      {user.app_metadata?.provider === 'google' && (user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                        <AvatarImage src={user.user_metadata?.avatar_url || user.user_metadata?.picture} alt="User" />
                      ) : (
                        <AvatarFallback className="bg-gray-200 text-gray-700">
                          {user?.user_metadata?.full_name 
                            ? `${user.user_metadata.full_name.split(' ')[0][0]}${user.user_metadata.full_name.split(' ')[1]?.[0] || ''}`
                            : typeof user.email === 'string' 
                              ? user.email.charAt(0).toUpperCase() 
                              : 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  ) : (
                    <Avatar className="h-full w-full">
                      <AvatarFallback className="bg-gray-200 text-gray-700">U</AvatarFallback>
                    </Avatar>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.email}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.user_metadata?.subscription_plan || 'Free plan'}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => handleNavigate('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Globe className="mr-2 h-4 w-4" />
                      <span>Language</span>
                      <span className="ml-auto text-xs rounded-full bg-muted px-2 py-0.5">BETA</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={language} onValueChange={changeLanguage}>
                        <DropdownMenuRadioItem value="en">
                          English
                          {language === "en" && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="zh-TW">
                          繁體中文
                          {language === "zh-TW" && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuItem onClick={() => handleNavigate('/subscription')}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Subscription</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      {/* 移動端背景遮罩 */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 md:hidden" 
          onClick={() => onOpenChange?.(false)} 
        />
      )}
    </>
  );
} 