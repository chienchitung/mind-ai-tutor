'use client';

import { Student } from "@/types/student";
import { StudentCard } from "./StudentCard";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

interface StudentStatsProps {
  students: Student[];
}

export function StudentStats({ students }: StudentStatsProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  // Calculate statistics for cards
  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.progress != null && s.progress > 0 && s.progress < 100).length;
  const completedStudents = students.filter(s => s.progress === 100).length;
  
  return (
    <div className="grid gap-6 md:grid-cols-3 mb-6">
      <StudentCard title={t('total_students')} count={totalStudents} />
      <StudentCard title={t('active_students')} count={activeStudents} />
      <StudentCard title={t('completed')} count={completedStudents} />
    </div>
  );
}