'use client';

import { useEffect, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/types/supabase';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface Attendance {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  notes?: string;
}

interface AttendanceTrackerProps {
  studentId: string;
}

export function AttendanceTracker({ studentId }: AttendanceTrackerProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedStatus, setSelectedStatus] = useState<
    'present' | 'absent' | 'late'
  >('present');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      setAttendance(data as Attendance[]);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
      toast({
        title: t('error'),
        description: t('failed_fetch_attendance'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .insert([
          {
            student_id: studentId,
            date: format(selectedDate, 'yyyy-MM-dd'),
            status: selectedStatus,
            notes: notes || undefined,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setAttendance((prev) => [data as Attendance, ...prev]);
      setNotes('');
      toast({
        title: t('success'),
        description: t('attendance_added'),
      });
    } catch (error) {
      console.error('Failed to add attendance:', error);
      toast({
        title: t('error'),
        description: t('failed_add_attendance'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getMonthStats = () => {
    if (!selectedDate) return null;

    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const days = eachDayOfInterval({ start, end });

    const monthAttendance = attendance.filter((a) => {
      const date = new Date(a.date);
      return date >= start && date <= end;
    });

    return {
      total: days.length,
      present: monthAttendance.filter((a) => a.status === 'present').length,
      absent: monthAttendance.filter((a) => a.status === 'absent').length,
      late: monthAttendance.filter((a) => a.status === 'late').length,
    };
  };

  const monthStats = getMonthStats();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('add_attendance')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
              <div className="flex gap-2">
                <Button
                  variant={selectedStatus === 'present' ? 'default' : 'outline'}
                  onClick={() => setSelectedStatus('present')}
                >
                  {t('attendance_present')}
                </Button>
                <Button
                  variant={selectedStatus === 'absent' ? 'default' : 'outline'}
                  onClick={() => setSelectedStatus('absent')}
                >
                  {t('attendance_absent')}
                </Button>
                <Button
                  variant={selectedStatus === 'late' ? 'default' : 'outline'}
                  onClick={() => setSelectedStatus('late')}
                >
                  {t('attendance_late')}
                </Button>
              </div>
              <textarea
                className="w-full rounded-md border p-2"
                placeholder={t('add_notes_optional')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button
                onClick={handleSubmit}
                disabled={!selectedDate || submitting}
              >
                {submitting ? t('adding') : t('add_attendance')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {monthStats && (
          <Card>
            <CardHeader>
              <CardTitle>
                {t('monthly_overview')} -{' '}
                {selectedDate ? format(selectedDate, 'MMMM yyyy') : ''}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>{t('total_days')}:</div>
                  <div>{monthStats.total}</div>
                  <div>{t('attendance_present')}:</div>
                  <div>{monthStats.present}</div>
                  <div>{t('attendance_absent')}:</div>
                  <div>{monthStats.absent}</div>
                  <div>{t('attendance_late')}:</div>
                  <div>{monthStats.late}</div>
                </div>
                <div className="h-2 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{
                      width: `${
                        (monthStats.present / monthStats.total) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('attendance_history')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <p>{t('loading_attendance_records')}</p>
            ) : attendance.length === 0 ? (
              <p>{t('no_attendance_records')}</p>
            ) : (
              <div className="space-y-2">
                {attendance.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <div className="font-medium">
                        {format(new Date(record.date), 'PPP')}
                      </div>
                      {record.notes && (
                        <div className="text-sm text-gray-500">
                          {record.notes}
                        </div>
                      )}
                    </div>
                    <div
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        record.status === 'present'
                          ? 'bg-green-100 text-green-800'
                          : record.status === 'absent'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {record.status.charAt(0).toUpperCase() +
                        record.status.slice(1)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 