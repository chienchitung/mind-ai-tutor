'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { StudentStats } from '@/components/students/StudentStats';
import { StudentFilters } from '@/components/students/StudentFilters';
import { StudentsTable } from '@/components/students/StudentsTable';
import { Button, buttonVariants } from '@/components/ui/button';
import { Download, Upload, FileDown, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ExcelJS from 'exceljs';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import type { Database } from '@/types/supabase';

type Student = Database['public']['Tables']['students']['Row'];
type StudentInsert = Database['public']['Tables']['students']['Insert'];

const IMPORT_HEADERS = {
  name: ['name', '姓名'],
  email: ['email', 'e-mail', '電子郵件', 'email address'],
  grade: ['grade', '年級'],
  subjects: ['subjects', '科目'],
  status: ['status', '狀態'],
};

function matchHeader(cell: unknown, aliases: string[]): boolean {
  const value = String(cell ?? '').trim().toLowerCase();
  return aliases.includes(value);
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"all" | "active">("all");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

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
        title: t('error'),
        description: t('error_fetching_students'),
        variant: 'destructive',
      });
      console.error('Error fetching students:', error);
      setStudents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        title: t('success'),
        description: t('students_exported'),
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: t('error'),
        description: t('error_exporting_students'),
        variant: "destructive",
      });
    }
  }

  async function downloadImportTemplate() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(t('students'));

    worksheet.addRow(['name', 'email', 'grade', 'subjects', 'status']);
    worksheet.addRow(['王小明', 'student1@example.com', 10, 'Mathematics,Science', 'active']);

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    worksheet.columns.forEach((column) => {
      if (column) column.width = 20;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_import_template.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        throw new Error('No worksheet found in the uploaded file');
      }

      const headerRow = worksheet.getRow(1);
      const columnIndex: Partial<Record<keyof typeof IMPORT_HEADERS, number>> = {};
      headerRow.eachCell((cell, colNumber) => {
        for (const key of Object.keys(IMPORT_HEADERS) as (keyof typeof IMPORT_HEADERS)[]) {
          if (matchHeader(cell.value, IMPORT_HEADERS[key])) {
            columnIndex[key] = colNumber;
          }
        }
      });

      if (!columnIndex.name || !columnIndex.email) {
        toast({
          title: t('import_failed'),
          description: t('import_missing_columns'),
          variant: 'destructive',
        });
        return;
      }

      const existingEmails = new Set(students.map((s) => s.email.toLowerCase()));
      const rowsToInsert: StudentInsert[] = [];
      let skippedMissingFields = 0;
      let skippedDuplicates = 0;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // header

        const name = String(row.getCell(columnIndex.name!).value ?? '').trim();
        const email = String(row.getCell(columnIndex.email!).value ?? '').trim();

        if (!name || !email) {
          if (name || email) skippedMissingFields++; // ignore fully blank rows silently
          return;
        }

        if (existingEmails.has(email.toLowerCase())) {
          skippedDuplicates++;
          return;
        }
        existingEmails.add(email.toLowerCase());

        const gradeRaw = columnIndex.grade ? row.getCell(columnIndex.grade).value : null;
        const grade = gradeRaw !== null && gradeRaw !== undefined && gradeRaw !== ''
          ? parseInt(String(gradeRaw), 10)
          : null;

        const subjectsRaw = columnIndex.subjects
          ? String(row.getCell(columnIndex.subjects).value ?? '')
          : '';
        const subjects = subjectsRaw
          .split(/[,、]/)
          .map((s) => s.trim())
          .filter(Boolean);

        const statusRaw = columnIndex.status
          ? String(row.getCell(columnIndex.status).value ?? '').trim().toLowerCase()
          : '';
        const status = statusRaw === 'inactive' ? 'inactive' : 'active';

        rowsToInsert.push({
          name,
          email,
          grade: Number.isFinite(grade) ? grade : null,
          subjects,
          status,
        });
      });

      if (rowsToInsert.length === 0) {
        toast({
          title: t('import_nothing_to_import'),
          description: t('import_no_valid_rows', {
            missing: skippedMissingFields,
            duplicates: skippedDuplicates,
          }),
          variant: 'destructive',
        });
        return;
      }

      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      const { error } = await supabaseClient.from('students').insert(rowsToInsert);

      if (error) {
        throw error;
      }

      toast({
        title: t('import_complete'),
        description: t('import_summary', {
          added: rowsToInsert.length,
          missing: skippedMissingFields,
          duplicates: skippedDuplicates,
        }),
      });

      await fetchStudents();
    } catch (error: any) {
      console.error('Error importing students:', error);
      toast({
        title: t('import_failed'),
        description: error.message || t('import_failed'),
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        heading={t('students')}
        text={t('manage_students')}
        actions={
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileSelected}
            />
            <Button
              onClick={downloadImportTemplate}
              variant="ghost"
              title={t('import_template')}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {t('import_template')}
            </Button>
            <Button
              onClick={handleImportClick}
              disabled={importing}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importing ? t('importing') : t('import_excel')}
            </Button>
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
          <StudentsTable
            students={students}
            selectedTab={selectedTab}
            onStudentDeleted={(id) => setStudents((prev) => prev.filter((s) => s.id !== id))}
          />
        </>
      )}
    </div>
  );
}
