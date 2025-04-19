'use client';

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

interface StudentStatusBadgeProps {
  progress: number;
}

export function StudentStatusBadge({ progress }: StudentStatusBadgeProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  let status = '';
  let variant: 'default' | 'destructive' | 'outline' | 'secondary' = 'default';
  let className = '';

  if (progress === 0) {
    status = t('not_started');
    variant = 'outline';
    className = 'bg-muted text-muted-foreground';
  } else if (progress === 100) {
    status = t('completed');
    variant = 'outline';
    className = 'bg-green-50 text-green-700 border-green-200';
  } else if (progress > 0) {
    status = t('in_progress');
    variant = 'outline';
    className = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  );
} 