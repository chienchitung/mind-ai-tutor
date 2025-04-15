'use client';

import { Student } from "@/types/student";
import { StudentCard } from "./StudentCard";

interface StudentStatsProps {
  students: Student[];
}

export function StudentStats({ students }: StudentStatsProps) {
  // Calculate statistics for cards
  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.progress > 0 && s.progress < 100).length;
  const completedStudents = students.filter(s => s.progress === 100).length;
  
  return (
    <div className="grid gap-6 md:grid-cols-3 mb-6">
      <StudentCard title="Total Students" count={totalStudents} />
      <StudentCard title="Active Students" count={activeStudents} />
      <StudentCard title="Completed" count={completedStudents} />
    </div>
  );
} 