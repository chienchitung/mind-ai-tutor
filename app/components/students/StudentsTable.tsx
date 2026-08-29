'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { StudentStatusBadge } from "./StudentStatusBadge";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/types/supabase";

type Student = Database['public']['Tables']['students']['Row'];

interface StudentsTableProps {
  students: Student[];
  selectedTab: "all" | "active";
  onStudentDeleted?: (id: string) => void;
}

export function StudentsTable({ students, selectedTab, onStudentDeleted }: StudentsTableProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setDeleting(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      const { error } = await supabaseClient
        .from('students')
        .delete()
        .eq('id', studentToDelete.id);

      if (error) throw error;

      toast({ title: t('success'), description: t('student_deleted') });
      onStudentDeleted?.(studentToDelete.id);
    } catch (error: any) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setStudentToDelete(null);
    }
  };

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
    {
      id: "actions",
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          title={t('delete_student')}
          onClick={(e) => {
            e.stopPropagation();
            setStudentToDelete(row.original);
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
    },
  ];

  const safeStudents = Array.isArray(students) ? students : [];

  const filteredStudents = selectedTab === "all"
    ? safeStudents
    : safeStudents.filter(student => student.status === 'active');

  return (
    <>
      <DataTable
        columns={columns}
        data={filteredStudents}
        searchColumn="name"
        searchPlaceholder={t('search_by_name')}
      />
      <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_student_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_student_confirm_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">{t('cancel')}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={handleConfirmDelete}
                disabled={deleting}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? t('deleting') : t('delete')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
