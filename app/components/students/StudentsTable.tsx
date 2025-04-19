'use client';

import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { StudentStatusBadge } from "./StudentStatusBadge";
import { Student } from "@/types/student";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

interface StudentsTableProps {
  students: Student[];
  selectedTab: "all" | "active";
}

export function StudentsTable({ students, selectedTab }: StudentsTableProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  const columns: ColumnDef<Student>[] = [
    {
      accessorKey: "name",
      header: t('name'),
      cell: ({ row }) => {
        const student = row.original;
        if (!student) return <div>N/A</div>;
        
        const name = student.name || "Unknown Student";
        const email = student.email || `student.${student.id || 'unknown'}@example.com`;
        
        // Safe rendering with fallbacks for all properties
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary">
                {name.split(" ").map(n => n[0] || '').join("").substring(0, 2) || 'ST'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{name}</div>
              <div className="text-xs text-muted-foreground">{email}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "enrolled",
      header: t('enrolled'),
      cell: ({ row }) => {
        const enrolledValue = row.getValue("enrolled");
        if (!enrolledValue) return <div>N/A</div>;
        
        try {
          const date = new Date(enrolledValue as string);
          return (
            <div className="text-sm">
              {date.toLocaleDateString(language === 'zh-TW' ? 'zh-TW' : 'en-US')}
            </div>
          );
        } catch (e) {
          return <div>Invalid Date</div>;
        }
      },
    },
    {
      accessorKey: "progress",
      header: t('progress'),
      cell: ({ row }) => {
        const progress = row.getValue("progress") as number || 0;
        const student = row.original;
        if (!student) return <div>N/A</div>;
        
        const lessonsCompleted = student.lessonsCompleted || 0;
        const totalLessons = student.totalLessons || 0;
        
        return (
          <div className="w-40">
            <div className="flex justify-between mb-1">
              <span className="text-xs font-medium">{progress}%</span>
              <span className="text-xs text-muted-foreground">
                {lessonsCompleted} / {totalLessons}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: t('status'),
      cell: ({ row }) => {
        const progress = row.original?.progress ?? 0;
        return <StudentStatusBadge progress={progress} />;
      },
    },
  ];
  
  // Ensure we have a valid students array to work with
  const safeStudents = Array.isArray(students) ? students : [];
  
  const filteredStudents = selectedTab === "all" 
    ? safeStudents 
    : safeStudents.filter(student => {
        if (!student) return false;
        const progress = student?.progress ?? 0;
        return progress > 0 && progress < 100;
      });
  
  return (
    <DataTable
      columns={columns}
      data={filteredStudents}
      searchColumn="name"
      searchPlaceholder={t('search_by_name')}
    />
  );
} 