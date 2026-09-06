'use client';

import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { ChevronRight, CreditCard, Globe, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage, type Language } from '@/app/contexts/LanguageContext';
import { useTranslation, translations } from '@/utils/translations';
import { confirmAppNavigation } from '@/lib/navigation-guard';

interface AccountMenuProps {
  user: User | null;
  /** "row": avatar + name/email + chevron (desktop sidebar). "icon":
   * avatar-only button (mobile topbar, and the collapsed desktop sidebar). */
  variant: 'row' | 'icon';
  className?: string;
}

/**
 * Shared account dropdown for the desktop sidebar and the mobile topbar
 * (see AppTopbar.tsx) - `user` is fetched once by their common AppLayout
 * ancestor and passed down, so mounting this in two places at once doesn't
 * double the Supabase round trip.
 */
export function AccountMenu({ user, variant, className }: AccountMenuProps) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation(language);
  const router = useRouter();
  const { toast } = useToast();
  const zh = language === 'zh-TW';

  // Fetched lazily on first open rather than on mount - this component
  // renders in both the sidebar and the topbar on every authenticated page,
  // so fetching eagerly would double a Supabase round trip nobody asked for
  // yet on every navigation (the same reasoning as AppLayout's user/isAdmin
  // fetch being lifted out of Sidebar - see that component's comment).
  const [points, setPoints] = useState<{ balance: number; monthlyGrant: number } | null>(null);
  const [pointsLoading, setPointsLoading] = useState(false);
  const loadPoints = async () => {
    if (points || pointsLoading || !user) return;
    setPointsLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase().rpc('get_ai_points_balance');
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row) setPoints({ balance: row.balance, monthlyGrant: row.monthly_grant });
    } finally {
      setPointsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!confirmAppNavigation()) return;
    try {
      const { supabase } = await import('@/lib/supabase');
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
    <DropdownMenu onOpenChange={(open) => { if (open) void loadPoints(); }}>
      <DropdownMenuTrigger asChild>
        {variant === 'row' ? (
          <Button variant="ghost" className={cn('h-auto w-full justify-start rounded-xl p-2', className)}>
            <Avatar className="mr-3 h-9 w-9 shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-muted text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium">{displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">{user?.email || t('free_plan')}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn('rounded-full', className)}
            aria-label={language === 'zh-TW' ? '帳號選單' : 'Account menu'}
          >
            <Avatar className="h-9 w-9">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-muted text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {points && (
          <>
            <div className="px-2 py-1.5">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{zh ? '本月 AI 點數' : 'AI credits this month'}</span>
                <span className="font-medium">{points.balance}/{points.monthlyGrant}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground transition-[width]"
                  style={{ width: `${points.monthlyGrant > 0 ? Math.round((points.balance / points.monthlyGrant) * 100) : 0}%` }}
                />
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => { if (confirmAppNavigation()) router.push('/settings'); }}>
            <Settings className="mr-2 h-4 w-4" />
            {t('settings')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { if (confirmAppNavigation()) router.push('/subscription'); }}>
            <CreditCard className="mr-2 h-4 w-4" />
            {t('subscription')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {/* Flat, not a nested submenu: Radix positions DropdownMenuSub's
            flyout relative to its trigger with no room to account for a
            narrow mobile viewport, and with this trigger sitting in the
            top-right corner the flyout had nowhere sane to open - it ended
            up rendering detached in a top corner instead of next to
            "Language". Two options don't need a submenu anyway. */}
        <DropdownMenuLabel className="flex items-center gap-2 px-2 pb-1 pt-1.5 text-xs font-normal text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          {t('language')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={language} onValueChange={(value) => changeLanguage(value as Language)}>
          <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="zh-TW">繁體中文</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {t('log_out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
