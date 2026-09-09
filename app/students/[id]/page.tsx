'use client';

import { useEffect, useState } from 'react';
import { supabase as getSupabaseClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, PageLoader } from '@/components/ui/page-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProgressHistory } from '@/components/students/ProgressHistory';
import { AttendanceTracker } from '@/components/students/AttendanceTracker';
import { AssignmentTracker } from '@/components/students/AssignmentTracker';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Copy, GraduationCap, KeyRound, Mail, RefreshCw, UserRound } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import type { Database } from '@/types/supabase';

type Student = Database['public']['Tables']['students']['Row'];

const LOGIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function generateLoginCode(length = 8): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => LOGIN_CODE_ALPHABET[n % LOGIN_CODE_ALPHABET.length]).join('');
}

// Postgrest error code for `.single()` matching zero (or multiple) rows -
// an expected "not found" outcome, not an unexpected error worth alarming
// the user with a raw toast for.
const NO_ROW_ERROR_CODE = 'PGRST116';

// Define the expected params type
interface StudentPageParams {
  id: string;
}

// Update the component props to expect a Promise for params
export default function StudentPage({ params: paramsPromise }: { params: Promise<StudentPageParams> }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [pageParams, setPageParams] = useState<StudentPageParams | null>(null); // State to hold resolved params
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation(language);

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
          description: t('error_fetching_students'),
          variant: 'destructive',
        });
        // Optionally redirect or show an error state
      }
    };
    resolveParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsPromise]);

  useEffect(() => {
    // Fetch student data only after params are resolved
    if (!pageParams) return;

    const fetchStudent = async () => {
      setLoading(true); // Ensure loading is true when fetch starts
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
        setStudent(null);
        // A missing row is an expected "not found" outcome (e.g. a stale
        // link to a deleted student) - the page already renders a friendly
        // not-found state for it below, so it doesn't also need a scary
        // error toast. Only genuinely unexpected errors do.
        if (error?.code !== NO_ROW_ERROR_CODE) {
          toast({
            title: t('error'),
            description: error.message,
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageParams]); // Depend on resolved pageParams

  const handleEdit = () => {
    if (!pageParams) return; // Ensure pageParams is available
    router.push(`/students/${pageParams.id}/edit`); // Use resolved id from state
  };

  const [generatingCode, setGeneratingCode] = useState(false);

  const handleGenerateLoginCode = async () => {
    if (!pageParams) return;
    setGeneratingCode(true);
    try {
      const supabase = getSupabaseClient();
      const code = generateLoginCode();
      const { data, error } = await supabase
        .from('students')
        .update({ login_code: code })
        .eq('id', pageParams.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setStudent(data);
      toast({
        title: t('success'),
        description: t('login_code_generated'),
      });
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyLoginCode = () => {
    if (!student?.login_code) return;
    navigator.clipboard.writeText(student.login_code);
    toast({ title: t('success'), description: t('login_code_copied') });
  };

  const handleDelete = async () => {
    if (!pageParams) return; // Ensure pageParams is available
    setDeleting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', pageParams.id); // Use resolved id from state

      if (error) {
        throw error;
      }

      toast({
        title: t('success'),
        description: t('student_deleted'),
      });

      router.push('/students');
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !pageParams) { // Show loading also if params haven't resolved yet
    return <PageLoader />;
  }

  if (!student) {
    return (
      <EmptyState title={t('student_not_found')} description={t('student_not_found_desc')} />
    );
  }

  const subjects = Array.isArray(student.subjects) ? student.subjects : [];
  const initials = student.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ST';

  return (
    <div className="space-y-5">
      <PageHeader heading={student.name} text={language === 'zh-TW' ? '集中查看學習表現、出席與作業狀態。' : 'Review learning progress, attendance, and assignments in one place.'}
        actions={<div className="flex flex-wrap gap-2">
          <Button onClick={handleEdit}>{t('edit_student')}</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">{t('delete_student')}</Button>
            </AlertDialogTrigger>
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
                    onClick={handleDelete}
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
        </div>}
      />
      <section className="app-panel overflow-hidden" aria-labelledby="student-overview-title">
        <h2 id="student-overview-title" className="sr-only">{t('basic_information')}</h2>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary" aria-hidden="true">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold">{student.name}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${student.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                    {student.status === 'active' ? t('active') : t('inactive')}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <p className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{student.email}</span></p>
                  <p className="flex items-center gap-2"><GraduationCap className="h-4 w-4 shrink-0" />{t('grade')}：{student.grade || t('not_available')}</p>
                </div>
                <div className="mt-4 flex items-start gap-2">
                  <BookOpen className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-wrap gap-2">
                    {subjects.length > 0 ? subjects.map((subject) => (
                      <span key={subject} className="rounded-full bg-secondary px-3 py-1 text-sm">{subject}</span>
                    )) : <span className="text-sm text-muted-foreground">{language === 'zh-TW' ? '尚未設定學習主題' : 'No subjects assigned'}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t bg-muted/20 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4" />{t('game_login_code')}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('game_login_code_desc')}</p>
            <div className="mt-3">
                {student.login_code ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-lg border bg-background px-3 py-2 font-mono text-base font-semibold tracking-[0.16em]">
                      {student.login_code}
                    </code>
                    <Button variant="outline" size="icon" onClick={handleCopyLoginCode} title={t('copy_login_code')} aria-label={t('copy_login_code')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateLoginCode}
                      disabled={generatingCode}
                      title={t('regenerate_login_code')}
                      aria-label={t('regenerate_login_code')}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={handleGenerateLoginCode} disabled={generatingCode} variant="outline">
                    {generatingCode ? t('generating') : t('generate_login_code')}
                  </Button>
                )}
            </div>
          </div>
        </div>
      </section>

        <Tabs defaultValue="progress" className="space-y-4">
          <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1 rounded-xl bg-muted/60 p-1 sm:min-w-0">
            <TabsTrigger value="progress" className="gap-2 px-4 py-2.5"><UserRound className="h-4 w-4" />{t('progress')}</TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2 px-4 py-2.5"><GraduationCap className="h-4 w-4" />{t('attendance')}</TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2 px-4 py-2.5"><BookOpen className="h-4 w-4" />{t('assignments')}</TabsTrigger>
          </TabsList>
          </div>
          <TabsContent value="progress" className="mt-0">
            <ProgressHistory studentId={student.id} />
          </TabsContent>
          <TabsContent value="attendance" className="mt-0">
            <AttendanceTracker studentId={student.id} />
          </TabsContent>
          <TabsContent value="assignments" className="mt-0">
            <AssignmentTracker studentId={student.id} />
          </TabsContent>
        </Tabs>
    </div>
  );
}
