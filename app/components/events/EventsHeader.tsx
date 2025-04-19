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
    <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between w-full">
      <ViewSelector />

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onAddEvent} className="h-8">
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('add_event')}
        </Button>
      </div>
    </div>
  );
} 