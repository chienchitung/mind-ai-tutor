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
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import type { Database } from '@/types/supabase';
import { PageHeader } from '@/components/layout/PageHeader';

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
  const { language } = useLanguage();
  const { t } = useTranslation(language);

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
        title: t('success'),
        description: t('student_added'),
      });

      router.push('/dashboard');
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

  const handleSubjectToggle = (subject: string) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader heading={t('add_new_student')} text={language === 'zh-TW' ? '建立學生資料，設定年級與學習主題。' : 'Create a student profile with their grade and learning topics.'} />
      <form onSubmit={handleSubmit} className="app-panel mx-auto max-w-2xl space-y-6 p-5 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('full_name')}</Label>
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
          <Label htmlFor="email">{t('email')}</Label>
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
          <Label htmlFor="grade">{t('grade')}</Label>
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
          <Label>{t('topics')}</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {subjects.map((subject) => (
              <Button
                key={subject}
                type="button"
                variant={
                  formData.subjects.includes(subject) ? 'default' : 'outline'
                }
                className="h-auto min-h-10 justify-start whitespace-normal text-left"
                aria-pressed={formData.subjects.includes(subject)}
                onClick={() => handleSubjectToggle(subject)}
              >
                {subject}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-5">
          <Button type="button" variant="outline" disabled={loading} onClick={() => router.push('/students')}>
            {t('cancel')}
          </Button>
        <Button type="submit" disabled={loading}>
          {loading ? t('adding_student') : t('add_student')}
        </Button>
        </div>
      </form>
    </div>
  );
}
