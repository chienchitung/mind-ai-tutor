'use client';

import React from "react";
import { useEvents } from "@/contexts/EventContext";
import { LayoutList, KanbanSquare, Table2, CalendarDays, GanttChartSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

export function ViewSelector() {
  const { activeView, setActiveView } = useEvents();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  return (
    <div className="flex items-center space-x-1">
      <Button
        variant={activeView === 'table' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-2"
        onClick={() => setActiveView('table')}
        aria-label={t('table_view')}
      >
        <Table2 className="h-4 w-4 mr-1" />
        <span>{t('table')}</span>
      </Button>
      
      <Button
        variant={activeView === 'kanban' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-2"
        onClick={() => setActiveView('kanban')}
        aria-label={t('kanban_view')}
      >
        <KanbanSquare className="h-4 w-4 mr-1" />
        <span>{t('kanban')}</span>
      </Button>
      
      <Button
        variant={activeView === 'calendar' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-2"
        onClick={() => setActiveView('calendar')}
        aria-label={t('calendar_view')}
      >
        <CalendarDays className="h-4 w-4 mr-1" />
        <span>{t('calendar')}</span>
      </Button>
      
      <Button
        variant={activeView === 'timeline' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 px-2"
        onClick={() => setActiveView('timeline')}
        aria-label={t('timeline_view')}
      >
        <GanttChartSquare className="h-4 w-4 mr-1" />
        <span>{t('timeline')}</span>
      </Button>
    </div>
  );
} 