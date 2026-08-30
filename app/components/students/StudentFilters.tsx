'use client';

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

interface StudentFiltersProps {
  selectedTab: "all" | "active";
  setSelectedTab: (tab: "all" | "active") => void;
}

export function StudentFilters({ selectedTab, setSelectedTab }: StudentFiltersProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  return (
    <div className="flex items-center">
      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as "all" | "active")}>
        <TabsList className="h-9">
          <TabsTrigger value="all">{t('all_students')}</TabsTrigger>
          <TabsTrigger value="active">{t('active_students_tab')}</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
