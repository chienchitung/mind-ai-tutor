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
          {isCollapsed ? (
            // When collapsed, only show the toggle button
            <div className="flex flex-col items-center w-full">
              <div 
                className="flex items-center justify-center p-2 rounded-md cursor-pointer text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                onClick={handleCollapse}
                aria-label="Expand sidebar"
              >
                <PanelLeft className="h-5 w-5 text-gray-500" />
              </div>
            </div>
          ) : (
            // When expanded
            <div className="flex items-center justify-between w-full">
              <Link href="/" className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 559" className="h-7 w-7 mr-2" style={{ fill: "#0F172A" }}>
                  <g transform="translate(0.000000,559.000000) scale(0.100000,-0.100000)" fill="#0F172A" stroke="none">
                    <path d="M2615 4828 c-2 -7 -11 -51 -20 -98 -49 -255 -124 -380 -273 -458 -62 -33 -269 -92 -321 -92 -36 0 -70 -25 -55 -40 6 -5 49 -17 97 -26 110 -19 206 -48 279 -85 151 -76 222 -194 273 -453 16 -85 25 -112 38 -114 20 -4 20 -4 42 118 63 341 187 466 526 530 63 12 119 26 124 32 16 15 -20 35 -78 42 -147 20 -306 78 -385 143 -90 74 -153 207 -188 398 -21 115 -21 115 -39 115 -9 0 -17 -6 -20 -12z"/>
                    <path d="M5036 4818 c-37 -182 -60 -267 -89 -331 -77 -166 -203 -247 -464 -297 -57 -11 -106 -20 -109 -20 -2 0 -4 -9 -4 -19 0 -16 12 -21 68 -31 379 -65 513 -188 576 -525 26 -137 25 -135 45 -135 15 0 20 13 31 78 7 42 23 114 36 160 76 263 207 364 547 423 41 7 71 17 74 26 3 7 4 16 1 18 -2 2 -51 13 -108 25 -362 70 -470 177 -544 538 -16 82 -25 108 -38 110 -11 2 -19 -5 -22 -20z"/>
                    <path d="M3905 3448 c-35 -9 -191 -161 -1337 -1307 -1398 -1398 -1331 -1325 -1314 -1413 24 -128 256 -360 384 -384 88 -17 17 -83 1400 1299 796 795 1291 1297 1304 1322 28 54 26 100 -7 165 -59 118 -176 235 -290 292 -65 33 -92 38 -140 26z m61 -392 c41 -40 74 -78 74 -82 0 -5 -105 -115 -234 -243 l-235 -235 -45 38 c-25 20 -62 57 -82 82 l-38 45 235 235 c128 129 238 234 243 234 4 0 42 -33 82 -74z"/>
                    <path d="M5045 2578 c-2 -7 -13 -53 -24 -103 -50 -236 -143 -324 -390 -371 -58 -12 -91 -22 -91 -31 0 -7 10 -15 23 -17 142 -30 187 -41 226 -58 139 -58 204 -158 241 -366 12 -67 24 -92 36 -79 3 3 14 49 25 103 50 247 136 333 383 385 89 18 123 34 95 43 -8 3 -56 14 -107 25 -132 29 -203 63 -262 128 -55 60 -83 125 -111 258 -10 50 -19 91 -19 93 0 8 -21 0 -25 -10z"/>
                  </g>
                </svg>
                <span className="text-xl font-bold whitespace-nowrap">MindAiTutor</span>
              </Link>
              <div 
                className="flex items-center px-3 py-2.5 rounded-md cursor-pointer text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                onClick={handleCollapse}
                aria-label="Collapse sidebar"
              >
                <PanelLeft className="h-5 w-5 text-gray-500" />
              </div>
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
                      {user && (user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                        <AvatarImage src={user.user_metadata?.avatar_url || user.user_metadata?.picture} alt="User" />
                      ) : (
                        <AvatarFallback className="bg-gray-200 text-gray-700">
                          {user?.user_metadata?.first_name && user?.user_metadata?.last_name
                            ? `${user.user_metadata.first_name[0]}${user.user_metadata.last_name[0]}`
                            : user?.user_metadata?.full_name 
                              ? `${user.user_metadata.full_name.split(' ')[0][0]}${user.user_metadata.full_name.split(' ')[1]?.[0] || ''}`
                              : typeof user?.email === 'string' 
                                ? user.email.charAt(0).toUpperCase() 
                                : 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    
                    <div className="flex flex-col text-sm text-left">
                      <span className="font-medium text-gray-900">
                        {user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}
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
                      {(user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                        <AvatarImage src={user.user_metadata?.avatar_url || user.user_metadata?.picture} alt="User" />
                      ) : (
                        <AvatarFallback className="bg-gray-200 text-gray-700">
                          {user?.user_metadata?.first_name && user?.user_metadata?.last_name
                            ? `${user.user_metadata.first_name[0]}${user.user_metadata.last_name[0]}`
                            : user?.user_metadata?.full_name 
                              ? `${user.user_metadata.full_name.split(' ')[0][0]}${user.user_metadata.full_name.split(' ')[1]?.[0] || ''}`
                              : typeof user?.email === 'string' 
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