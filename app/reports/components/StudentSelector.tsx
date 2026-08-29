'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface StudentSelectorProps {
  students: { id: string; name: string }[];
  selectedStudent: string | null;
  onSelectStudent: (studentId: string) => void;
}

export function StudentSelector({ students, selectedStudent, onSelectStudent }: StudentSelectorProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  if (!students.length) {
    return (
      <div className="text-sm text-muted-foreground">
        {t('no_students_available')}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <User className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedStudent || ''}
        onValueChange={onSelectStudent}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={t('select_a_student')} />
        </SelectTrigger>
        <SelectContent>
          {students.map((student) => (
            <SelectItem key={student.id} value={student.id}>
              {student.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
} 