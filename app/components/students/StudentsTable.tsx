'use client';

import Link from 'next/link';
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StudentStatusBadge } from "./StudentStatusBadge";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";
import type { Database } from "@/types/supabase";

type Student = Database['public']['Tables']['students']['Row'];

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
        const name = student.name || t('unknown_student');

        return (
          <Link href={`/students/${student.id}`} className="flex items-center gap-3 hover:underline">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary">
                {name.split(" ").map(n => n[0] || '').join("").substring(0, 2) || 'ST'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{name}</div>
              <div className="text-xs text-muted-foreground">{student.email}</div>
            </div>
          </Link>
        );
      },
    },
    {
      accessorKey: "grade",
      header: t('grade'),
      cell: ({ row }) => row.original.grade ?? t('not_available'),
    },
    {
      accessorKey: "subjects",
      header: t('topics'),
      cell: ({ row }) => {
        const subjects = row.original.subjects;
        return subjects && subjects.length > 0 ? subjects.join(', ') : t('not_available');
      },
    },
    {
      accessorKey: "created_at",
      header: t('enrolled'),
      cell: ({ row }) => {
        const value = row.getValue("created_at");
        if (!value) return <div>{t('not_available')}</div>;

        try {
          const date = new Date(value as string);
          return (
            <div className="text-sm">
              {date.toLocaleDateString(language === 'zh-TW' ? 'zh-TW' : 'en-US')}
            </div>
          );
        } catch (e) {
          return <div>{t('not_available')}</div>;
        }
      },
    },
    {
      accessorKey: "status",
      header: t('status'),
      cell: ({ row }) => <StudentStatusBadge status={row.original.status} />,
    },
  ];

  const safeStudents = Array.isArray(students) ? students : [];

  const filteredStudents = selectedTab === "all"
    ? safeStudents
    : safeStudents.filter(student => student.status === 'active');

  return (
    <DataTable
      columns={columns}
      data={filteredStudents}
      searchColumn="name"
      searchPlaceholder={t('search_by_name')}
    />
  );
}
