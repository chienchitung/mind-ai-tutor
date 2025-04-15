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
import type { Database } from '@/types/supabase';

type Student = Database['public']['Tables']['students']['Row'];

export default function StudentPage({ params }: { params: { id: string } }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) {
          throw error;
        }

        setStudent(data);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStudent();
  }, [supabase, params.id, toast]);

  const handleEdit = () => {
    router.push(`/students/${params.id}/edit`);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', params.id);

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Student deleted successfully',
      });

      router.push('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p>Loading student details...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p>Student not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{student.name}</h1>
        <div className="flex gap-2">
          <Button onClick={handleEdit}>Edit Student</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete Student</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  student and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
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
              <h2 className="text-lg font-semibold">Basic Information</h2>
              <div className="mt-2 space-y-2">
                <p>
                  <span className="font-medium">Email:</span> {student.email}
                </p>
                <p>
                  <span className="font-medium">Grade:</span> {student.grade}
                </p>
                <p>
                  <span className="font-medium">Status:</span>{' '}
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                      student.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {student.status}
                  </span>
                </p>
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Subjects</h2>
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
        </div>

        <Tabs defaultValue="progress" className="mt-6">
          <TabsList>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
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