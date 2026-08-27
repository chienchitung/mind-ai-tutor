'use client';

import { StudentCard } from "./StudentCard";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";
import type { Database } from "@/types/supabase";

type Student = Database['public']['Tables']['students']['Row'];

interface StudentStatsProps {
  students: Student[];
}

export function StudentStats({ students }: StudentStatsProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'active').length;
  const inactiveStudents = totalStudents - activeStudents;

  return (
    <div className="grid gap-6 md:grid-cols-3 mb-6">
      <StudentCard title={t('total_students')} count={totalStudents} />
      <StudentCard title={t('active_students')} count={activeStudents} />
      <StudentCard title={t('inactive_students')} count={inactiveStudents} />
    </div>
  );
}
