'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
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

export default function EditStudentPage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: student.name,
          email: student.email,
          grade: student.grade,
          subjects: student.subjects,
          status: student.status,
        })
        .eq('id', student.id);

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Student updated successfully',
      });

      router.push(`/students/${params.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
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
    <div className="container mx-auto max-w-2xl py-10">
      <h1 className="mb-8 text-3xl font-bold">Edit Student</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
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
          <Label htmlFor="email">Email</Label>
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
          <Label htmlFor="grade">Grade</Label>
          <Input
            id="grade"
            type="number"
            min="1"
            max="12"
            value={student.grade}
            onChange={(e) =>
              setStudent((prev) =>
                prev ? { ...prev, grade: parseInt(e.target.value) } : null
              )
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={student.status}
            onValueChange={(value: 'active' | 'inactive') =>
              setStudent((prev) => (prev ? { ...prev, status: value } : null))
            }
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Subjects</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {subjects.map((subject) => (
              <Button
                key={subject}
                type="button"
                variant={
                  student.subjects.includes(subject) ? 'default' : 'outline'
                }
                className="justify-start"
                onClick={() => handleSubjectToggle(subject)}
              >
                {subject}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/students/${params.id}`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updating}>
            {updating ? 'Updating Student...' : 'Update Student'}
          </Button>
        </div>
      </form>
    </div>
  );
} 