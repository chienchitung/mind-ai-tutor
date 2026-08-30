'use client';

import React from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { ViewSelector } from "./ViewSelector";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

interface EventsHeaderProps {
  onAddEvent: () => void;
}

export function EventsHeader({ onAddEvent }: EventsHeaderProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <div className="app-panel flex w-full flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="overflow-x-auto pb-1 sm:pb-0"><ViewSelector /></div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onAddEvent} className="h-9 w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('add_event')}
        </Button>
      </div>
    </div>
  );
}
