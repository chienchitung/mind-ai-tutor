'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/types/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface Assignment {
  id: string;
  student_id: string;
  subject: string;
  title: string;
  description: string;
  due_date: string;
  status: 'pending' | 'completed' | 'overdue';
  score?: number;
  feedback?: string;
}

interface AssignmentTrackerProps {
  studentId: string;
}

export function AssignmentTracker({ studentId }: AssignmentTrackerProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(
    null
  );
  const [formData, setFormData] = useState({
    subject: '',
    title: '',
    description: '',
    dueDate: new Date(),
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('student_id', studentId)
        .order('due_date', { ascending: true });

      if (error) {
        throw error;
      }

      setAssignments(data as Assignment[]);
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
      toast({
        title: t('error'),
        description: t('failed_fetch_assignments'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.subject || !formData.title || !formData.dueDate) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('assignments')
        .insert([
          {
            student_id: studentId,
            subject: formData.subject,
            title: formData.title,
            description: formData.description,
            due_date: format(formData.dueDate, 'yyyy-MM-dd'),
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setAssignments((prev) => [...prev, data as Assignment]);
      setDialogOpen(false);
      setFormData({
        subject: '',
        title: '',
        description: '',
        dueDate: new Date(),
      });
      toast({
        title: t('success'),
        description: t('assignment_added'),
      });
    } catch (error) {
      console.error('Failed to add assignment:', error);
      toast({
        title: t('error'),
        description: t('failed_add_assignment'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateAssignmentStatus = async (
    assignmentId: string,
    status: 'completed' | 'pending' | 'overdue',
    score?: number,
    feedback?: string
  ) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ status, score, feedback })
        .eq('id', assignmentId);

      if (error) {
        throw error;
      }

      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId ? { ...a, status, score, feedback } : a
        )
      );
      toast({
        title: t('success'),
        description: t('assignment_status_updated'),
      });
    } catch (error) {
      console.error('Failed to update assignment:', error);
      toast({
        title: t('error'),
        description: t('failed_update_assignment_status'),
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: Assignment['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">{t('assignments')}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>{t('add_assignment')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('add_new_assignment')}</DialogTitle>
              <DialogDescription>
                {t('create_assignment_desc')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="subject">{t('subject_label')}</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">{t('title')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">{t('description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('assignment_due_date')}</Label>
                <Calendar
                  mode="single"
                  selected={formData.dueDate}
                  onSelect={(date) =>
                    setFormData((prev) => ({
                      ...prev,
                      dueDate: date || new Date(),
                    }))
                  }
                  className="rounded-md border"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  !formData.subject ||
                  !formData.title ||
                  !formData.dueDate
                }
              >
                {submitting ? t('adding') : t('add_assignment')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <p>{t('loading_assignments')}</p>
          </CardContent>
        </Card>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p>{t('no_assignments_found')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{assignment.title}</CardTitle>
                  <div
                    className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(
                      assignment.status
                    )}`}
                  >
                    {assignment.status.charAt(0).toUpperCase() +
                      assignment.status.slice(1)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{t('subject_label')}</p>
                    <p>{assignment.subject}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {t('description')}
                    </p>
                    <p>{assignment.description}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">{t('assignment_due_date')}</p>
                    <p>{format(new Date(assignment.due_date), 'PPP')}</p>
                  </div>
                  {assignment.status === 'completed' && (
                    <>
                      {assignment.score && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            {t('score_label')}
                          </p>
                          <p>{assignment.score}%</p>
                        </div>
                      )}
                      {assignment.feedback && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            {t('feedback')}
                          </p>
                          <p>{assignment.feedback}</p>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex gap-2">
                    {assignment.status !== 'completed' && (
                      <Button
                        onClick={() =>
                          updateAssignmentStatus(assignment.id, 'completed')
                        }
                      >
                        {t('mark_as_completed')}
                      </Button>
                    )}
                    {assignment.status === 'completed' && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          updateAssignmentStatus(assignment.id, 'pending')
                        }
                      >
                        {t('mark_as_pending')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 