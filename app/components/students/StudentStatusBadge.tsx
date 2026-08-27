'use client';

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

interface StudentStatusBadgeProps {
  status: string;
}

export function StudentStatusBadge({ status }: StudentStatusBadgeProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const isActive = status === 'active';

  return (
    <Badge
      variant="outline"
      className={isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted text-muted-foreground'}
    >
      {isActive ? t('active') : t('inactive')}
    </Badge>
  );
}
