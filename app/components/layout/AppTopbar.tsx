'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface AppTopbarProps {
  onOpenMenu: () => void;
}

export function AppTopbar({ onOpenMenu }: AppTopbarProps) {
  const pathname = usePathname();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const section = pathname.startsWith('/students')
    ? t('students')
    : pathname.startsWith('/lessons')
      ? t('lessons')
      : pathname.startsWith('/digital-games')
        ? t('digital_games')
        : pathname.startsWith('/ai-quiz')
          ? t('ai_quiz')
          : pathname.startsWith('/feedback')
            ? t('feedback')
            : pathname.startsWith('/events')
              ? t('events')
              : pathname.startsWith('/activities')
                ? t('activities')
                : pathname.startsWith('/reports')
                  ? t('reports')
                  : pathname.startsWith('/admin')
                    ? (language === 'zh-TW' ? '系統管理' : 'Administration')
                    : t('dashboard');

  const openCommandMenu = () => {
    window.dispatchEvent(new CustomEvent('mindai:open-command-menu'));
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center border-b border-border/70 bg-background/90 px-4 backdrop-blur md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="mr-2 md:hidden"
        onClick={onOpenMenu}
        aria-label={language === 'zh-TW' ? '開啟導覽選單' : 'Open navigation'}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0">
        <p className="app-kicker">MindAiTutor</p>
        <p className="truncate text-sm font-medium">{section}</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          className="hidden h-9 w-64 justify-start gap-2 bg-card text-muted-foreground lg:flex"
          onClick={openCommandMenu}
        >
          <Search className="h-4 w-4" />
          <span>{language === 'zh-TW' ? '搜尋功能與頁面' : 'Search pages and actions'}</span>
          <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={openCommandMenu}
          aria-label={t('search')}
        >
          <Search className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/activities" aria-label={t('activities')}>
            <Bell className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
