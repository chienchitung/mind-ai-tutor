'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PageHeader } from '@/components/layout/PageHeader';
import { StudentStats } from '@/components/students/StudentStats';
import { StudentFilters } from '@/components/students/StudentFilters';
import { StudentsTable } from '@/components/students/StudentsTable';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ExcelJS from 'exceljs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import type { Student } from '../types/student';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Helper function to get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"all" | "active">("all");
  const { toast } = useToast();

  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        console.log("Fetching students from learning_records_view");
        
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();
        
        const { data, error } = await supabaseClient
          .from('learning_records_view')
          .select('*');
          
        if (error) {
          throw error;
        }
        
        // Map the learning records to student data
        const mappedData = data?.map((record) => ({
          id: record.student_id || `unknown-${Math.random()}`,
          name: record.student_name || 'Unknown Student',
          email: record.student_email || `student@example.com`,
          enrolled: record.enrolled_date || new Date().toISOString(),
          progress: record.progress_percentage || Math.floor(Math.random() * 100),
          lessonsCompleted: record.completed_lessons || 0,
          totalLessons: record.total_lessons || 30,
        })) || [];

        // Group by student id to avoid duplicates
        const uniqueStudents = Object.values(
          mappedData.reduce((acc, student) => {
            if (!acc[student.id]) {
              acc[student.id] = student;
            }
            return acc;
          }, {} as Record<string, Student>)
        ) as Student[];
        
        if (uniqueStudents.length > 0) {
          setStudents(uniqueStudents);
        } else {
          // Fallback to sample data if no real data is available
          setStudents(createSampleStudents());
        }
      } catch (error) {
        toast({
          title: 'Error fetching students',
          description: 'Failed to load student data. Please try again later.',
          variant: 'destructive',
        });
        console.error('Error fetching students:', error);
        
        // Set sample data on error for demonstration purposes
        setStudents(createSampleStudents());
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, [toast]);

  // Create sample student data for demonstration
  function createSampleStudents(): Student[] {
    return Array.from({ length: 10 }, (_, i) => {
      const progress = Math.floor(Math.random() * 100);
      const totalLessons = 30;
      const lessonsCompleted = Math.floor((progress / 100) * totalLessons);
      
      return {
        id: `sample-${i + 1}`,
        name: `Student ${i + 1}`,
        email: `student${i + 1}@example.com`,
        enrolled: new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000).toISOString(),
        progress,
        lessonsCompleted,
        totalLessons,
      };
    });
  }

  // Update the exportToExcel function to handle possibly undefined fields
  async function exportToExcel() {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Students');

      // Add headers
      worksheet.addRow(['Name', 'Email', 'Status', 'Enrolled Date', 'Progress']);

      // Add data
      students.forEach((student: Student) => {
        worksheet.addRow([
          student.name,
          student.email,
          student.status || 'Active',
          student.enrolled ? new Date(student.enrolled).toLocaleDateString() : 'N/A',
          `${student.progress || 0}%`
        ]);
      });

      // Style the header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        if (column) {
          column.width = 15;
        }
      });

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Create blob and download
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
        heading="Students"
        text="Manage your students and track their progress."
        actions={
          <Button 
            onClick={exportToExcel}
            className={cn(
              buttonVariants({ 
                variant: "default"
              })
            )}
          >
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        }
      />
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <p>Loading student data...</p>
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