'use client';

import { useState } from 'react';
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

export default function NewStudentPage() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    grade: '',
    subjects: [] as string[],
  });
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      const { error } = await supabaseClient.from('students').insert({
        name: formData.name,
        email: formData.email,
        grade: parseInt(formData.grade),
        subjects: formData.subjects,
        status: 'active',
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Student added successfully',
      });

      router.push('/dashboard');
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

  const handleSubjectToggle = (subject: string) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }));
  };

  return (
    <div className="container mx-auto max-w-2xl py-10">
      <h1 className="mb-8 text-3xl font-bold">Add New Student</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
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
            value={formData.grade}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, grade: e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Subjects</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {subjects.map((subject) => (
              <Button
                key={subject}
                type="button"
                variant={
                  formData.subjects.includes(subject) ? 'default' : 'outline'
                }
                className="justify-start"
                onClick={() => handleSubjectToggle(subject)}
              >
                {subject}
              </Button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Adding Student...' : 'Add Student'}
        </Button>
      </form>
    </div>
  );
} 