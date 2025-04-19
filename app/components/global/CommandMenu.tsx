'use client';

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { 
  Calculator, 
  FileSpreadsheet, 
  BarChart3, 
  Settings, 
  Home, 
  BookOpen, 
  Gamepad2, 
  Users, 
  Calendar,
  Bell,
  MessageSquare,
  Wand2 
} from "lucide-react";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

interface NavItem {
  icon: React.ElementType;
  name: string;
  path: string;
  keywords: string;
}

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  // Setup keyboard shortcut to open command menu
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  // Navigation items
  const navItems: NavItem[] = [
    {
      icon: Home,
      name: t('dashboard'),
      path: "/dashboard",
      keywords: "home main dashboard overview analytics charts",
    },
    {
      icon: Users,
      name: t('students'),
      path: "/students",
      keywords: "learners pupils education users",
    },
    {
      icon: Bell,
      name: t('activities'),
      path: "/activities",
      keywords: "activities notifications alerts feed updates",
    },
    {
      icon: BookOpen,
      name: t('lessons'),
      path: "/lessons",
      keywords: "courses curriculum teaching learning excel genially",
    },
    {
      icon: Gamepad2,
      name: t('digital_games'),
      path: "/digital-games",
      keywords: "games interactive learning education digital",
    },
    {
      icon: Wand2,
      name: t('ai_quiz'),
      path: "/ai-quiz",
      keywords: "quiz questions assessment test ai artificial intelligence gemini",
    },
    {
      icon: MessageSquare,
      name: t('feedback'),
      path: "/feedback",
      keywords: "comments reviews assessment evaluation",
    },
    {
      icon: Calendar,
      name: t('events'),
      path: "/events",
      keywords: "events activities calendar schedule",
    },
    {
      icon: BarChart3,
      name: t('reports'),
      path: "/reports",
      keywords: "statistics data charts metrics progress insights reporting",
    },
    {
      icon: Settings,
      name: t('settings'),
      path: "/settings",
      keywords: "preferences appearance configuration theme language font",
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={`${t('search')}... (${t('try_typing')}: settings)`} />
      <CommandList>
        <CommandEmpty>{t('no_results_found')}</CommandEmpty>
        
        <CommandGroup heading={t('navigation')}>
          {navItems.map((item) => (
            <CommandItem
              key={item.path}
              value={`${item.name} ${item.keywords}`}
              onSelect={() => runCommand(() => router.push(item.path))}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        
        <CommandSeparator />

        <CommandGroup heading={t('quick_actions')}>
          <CommandItem 
            onSelect={() => runCommand(() => window.open("https://www.genial.ly", "_blank"))}
          >
            <Calculator className="mr-2 h-4 w-4" />
            <span>{t('open_genially')}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
} 