'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportLearningRecordsToCsv } from '../../utils/csv-export';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

// Define minimal interface for records
interface LearningRecord {
  id: number;
  student_id: string;
  student_name: string;
  lesson_id: number;
  started_at?: string;
  completed_at?: string | null;
  time_spent_seconds?: number;
  category?: string | null;
  started_at_taipei?: string;
  completed_at_taipei?: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
}

interface ExportButtonProps {
  records: LearningRecord[];
  studentName?: string | null;
  disabled?: boolean;
}

export function ExportButton({ records, studentName, disabled = false }: ExportButtonProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const handleExport = () => {
    if (records.length === 0) return;
    const safeStudentName = studentName || 'unknown';
    exportLearningRecordsToCsv(records, safeStudentName);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || records.length === 0}
      onClick={handleExport}
    >
      <Download className="mr-2 h-4 w-4" />
      {t('export_data')}
    </Button>
  );
} 