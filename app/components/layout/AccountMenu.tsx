'use client';

import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, CreditCard, Globe, LogOut, Settings } from 'lucide-react';
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
    <DropdownMenu>
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
        <DropdownMenuGroup>
          {/* Mobile has its own direct Settings icon in AppTopbar (visible
              at every width) - shown here only at >=768px so mobile isn't
              offered the same destination twice in the same topbar. */}
          <DropdownMenuItem className="hidden md:flex" onClick={() => { if (confirmAppNavigation()) router.push('/settings'); }}>
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
  );
}
