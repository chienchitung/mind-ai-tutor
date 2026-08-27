'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { StudentStats } from '@/components/students/StudentStats';
import { StudentFilters } from '@/components/students/StudentFilters';
import { StudentsTable } from '@/components/students/StudentsTable';
import { Button, buttonVariants } from '@/components/ui/button';
import { Download, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ExcelJS from 'exceljs';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import type { Database } from '@/types/supabase';

type Student = Database['public']['Tables']['students']['Row'];

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"all" | "active">("all");
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();

        const { data, error } = await supabaseClient
          .from('students')
          .select('*')
          .order('name');

        if (error) {
          throw error;
        }

        setStudents(data || []);
      } catch (error) {
        toast({
          title: 'Error fetching students',
          description: 'Failed to load student data. Please try again later.',
          variant: 'destructive',
        });
        console.error('Error fetching students:', error);
        setStudents([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, [toast]);

  async function exportToExcel() {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(t('students'));

      worksheet.addRow([t('name'), t('email'), t('status'), t('enrolled'), t('grade')]);

      students.forEach((student) => {
        worksheet.addRow([
          student.name,
          student.email,
          student.status,
          student.created_at ? new Date(student.created_at).toLocaleDateString() : 'N/A',
          student.grade ?? 'N/A',
        ]);
      });

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      worksheet.columns.forEach((column) => {
        if (column) {
          column.width = 15;
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();

      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'students.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Students data exported successfully",
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Error",
        description: "Failed to export students data",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        heading={t('students')}
        text={t('manage_students')}
        actions={
          <div className="flex gap-2">
            <Button
              onClick={exportToExcel}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Download className="mr-2 h-4 w-4" />
              {t('export_to_excel')}
            </Button>
            <Link href="/students/new" className={cn(buttonVariants({ variant: "default" }))}>
              <Plus className="mr-2 h-4 w-4" />
              {t('add_student')}
            </Link>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <p>{t('loading_student_data')}</p>
        </div>
      ) : (
        <>
          <StudentStats students={students} />
          <StudentFilters selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
          <StudentsTable students={students} selectedTab={selectedTab} />
        </>
      )}
    </div>
  );
}
