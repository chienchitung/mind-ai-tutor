'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { KeyRound, RefreshCw, Copy } from 'lucide-react';
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
  const supabase = createClientComponentClient<Database>();

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
  }, [supabase, pageParams]); // Depend on resolved pageParams

  const handleEdit = () => {
    if (!pageParams) return; // Ensure pageParams is available
    router.push(`/students/${pageParams.id}/edit`); // Use resolved id from state
  };

  const [generatingCode, setGeneratingCode] = useState(false);

  const handleGenerateLoginCode = async () => {
    if (!pageParams) return;
    setGeneratingCode(true);
    try {
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
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p>{t('loading_student_details')}</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-1">
        <p className="text-lg font-medium">{t('student_not_found')}</p>
        <p className="text-sm text-muted-foreground">{t('student_not_found_desc')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{student.name}</h1>
        <div className="flex gap-2">
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
        </div>
      </div>
      <Separator className="my-6" />
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{t('basic_information')}</h2>
              <div className="mt-2 space-y-2">
                <p>
                  <span className="font-medium">{t('email')}:</span> {student.email}
                </p>
                <p>
                  <span className="font-medium">{t('grade')}:</span> {student.grade}
                </p>
                <p>
                  <span className="font-medium">{t('status')}:</span>{' '}
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                      student.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {student.status === 'active' ? t('active') : t('inactive')}
                  </span>
                </p>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('topics')}</h2>
              <ScrollArea className="mt-2 h-[200px] rounded-md border p-4">
                <div className="space-y-2">
                  {student.subjects.map((subject) => (
                    <div
                      key={subject}
                      className="rounded-lg bg-secondary/50 px-3 py-2"
                    >
                      {subject}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                {t('game_login_code')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('game_login_code_desc')}
              </p>
              <div className="mt-3">
                {student.login_code ? (
                  <div className="flex items-center gap-2">
                    <code className="rounded-md border bg-secondary/50 px-3 py-2 text-lg font-mono tracking-widest">
                      {student.login_code}
                    </code>
                    <Button variant="outline" size="icon" onClick={handleCopyLoginCode} title={t('copy_login_code')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateLoginCode}
                      disabled={generatingCode}
                      title={t('regenerate_login_code')}
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
        </div>

        <Tabs defaultValue="progress" className="mt-6">
          <TabsList>
            <TabsTrigger value="progress">{t('progress')}</TabsTrigger>
            <TabsTrigger value="attendance">{t('attendance')}</TabsTrigger>
            <TabsTrigger value="assignments">{t('assignments')}</TabsTrigger>
          </TabsList>
          <TabsContent value="progress" className="mt-6">
            <ProgressHistory studentId={student.id} />
          </TabsContent>
          <TabsContent value="attendance" className="mt-6">
            <AttendanceTracker studentId={student.id} />
          </TabsContent>
          <TabsContent value="assignments" className="mt-6">
            <AssignmentTracker studentId={student.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
