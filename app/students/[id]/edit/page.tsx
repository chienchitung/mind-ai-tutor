'use client';

import { useEffect, useState } from 'react';
import { supabase as getSupabaseClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/types/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, PageLoader } from '@/components/ui/page-state';

type Student = Database['public']['Tables']['students']['Row'];

const subjects = [
  'Mathematics',
  'English',
  'Science',
  'History',
  'Geography',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Art',
  'Music',
];

// Define the expected params type
interface EditStudentPageParams {
  id: string;
}

// Update the component props to expect a Promise for params
export default function EditStudentPage({ params: paramsPromise }: { params: Promise<EditStudentPageParams> }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [pageParams, setPageParams] = useState<EditStudentPageParams | null>(null); // State to hold resolved params
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Resolve the params promise when the component mounts
    const resolveParams = async () => {
      try {
        const resolvedParams = await paramsPromise;
        setPageParams(resolvedParams);
      } catch (error) {
        console.error("Error resolving page params:", error);
        toast({
          title: t('error'),
          description: t('could_not_load_page_params'),
          variant: 'destructive',
        });
      }
    };
    resolveParams();
  }, [paramsPromise, toast, t]);

  useEffect(() => {
    // Fetch student data only after params are resolved
    if (!pageParams) return;

    const fetchStudent = async () => {
      setLoading(true); // Set loading true when fetching starts
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('id', pageParams.id) // Use resolved id from state
          .single();

        if (error) {
          throw error;
        }

        setStudent(data);
      } catch (error: any) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageParams]); // Depend on resolved pageParams

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !pageParams) return; // Ensure pageParams is available

    setUpdating(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('students')
        .update({
          name: student.name,
          email: student.email,
          grade: student.grade,
          subjects: student.subjects,
          status: student.status,
        })
        .eq('id', student.id); // student.id should be correct here

      if (error) {
        throw error;
      }

      toast({
        title: t('success'),
        description: t('student_updated'),
      });

      router.push(`/students/${pageParams.id}`); // Use resolved id from state for navigation
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleSubjectToggle = (subject: string) => {
    if (!student) return;

    setStudent((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        subjects: prev.subjects.includes(subject)
          ? prev.subjects.filter((s) => s !== subject)
          : [...prev.subjects, subject],
      };
    });
  };

  if (loading || !pageParams) { // Show loading also if params haven't resolved yet
    return <PageLoader />;
  }

  if (!student) {
    return (
      <EmptyState title={t('student_not_found')} description={t('student_not_found_desc')} />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader heading={t('edit_student')} text={student.name} />
      <form onSubmit={handleSubmit} className="app-panel mx-auto max-w-2xl space-y-6 p-5 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('full_name')}</Label>
          <Input
            id="name"
            value={student.name}
            onChange={(e) =>
              setStudent((prev) =>
                prev ? { ...prev, name: e.target.value } : null
              )
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            value={student.email}
            onChange={(e) =>
              setStudent((prev) =>
                prev ? { ...prev, email: e.target.value } : null
              )
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grade">{t('grade')}</Label>
          <Input
            id="grade"
            type="number"
            min="1"
            max="12"
            value={student.grade ?? ''}
            onChange={(e) =>
              setStudent((prev) =>
                prev ? { ...prev, grade: parseInt(e.target.value) } : null
              )
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">{t('status')}</Label>
          <Select
            value={student.status}
            onValueChange={(value: 'active' | 'inactive') =>
              setStudent((prev) => (prev ? { ...prev, status: value } : null))
            }
          >
            <SelectTrigger id="status">
              <SelectValue placeholder={t('select_status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t('active')}</SelectItem>
              <SelectItem value="inactive">{t('inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('subjects_label')}</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {subjects.map((subject) => (
              <Button
                key={subject}
                type="button"
                variant={
                  student.subjects.includes(subject) ? 'default' : 'outline'
                }
                className="h-auto min-h-10 justify-start whitespace-normal text-left"
                aria-pressed={student.subjects.includes(subject)}
                onClick={() => handleSubjectToggle(subject)}
              >
                {subject}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/students/${pageParams.id}`)} // Use resolved id from state
          >
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={updating}>
            {updating ? t('updating_student') : t('update_student')}
          </Button>
        </div>
      </form>
    </div>
  );
}
