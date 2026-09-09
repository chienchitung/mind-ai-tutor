'use client';

import { useEffect, useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { supabase as getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { CalendarCheck, CheckCircle2, Clock3, XCircle } from 'lucide-react';

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

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAttendance = async () => {
    try {
      const supabase = getSupabaseClient();
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
      const supabase = getSupabaseClient();
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
    const monthAttendance = attendance.filter((a) => {
      const date = new Date(a.date);
      return date >= start && date <= end;
    });

    return {
      total: monthAttendance.length,
      present: monthAttendance.filter((a) => a.status === 'present').length,
      absent: monthAttendance.filter((a) => a.status === 'absent').length,
      late: monthAttendance.filter((a) => a.status === 'late').length,
    };
  };

  const monthStats = getMonthStats();
  const attendanceRate = monthStats && monthStats.total > 0
    ? Math.round((monthStats.present / monthStats.total) * 100)
    : 0;
  const statusLabel = (status: Attendance['status']) => ({
    present: t('attendance_present'),
    absent: t('attendance_absent'),
    late: t('attendance_late'),
  })[status];

  return (
    <div className="space-y-4">
      {monthStats && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: language === 'zh-TW' ? '本月出席率' : 'Attendance rate', value: `${attendanceRate}%`, icon: CalendarCheck, tone: 'text-primary bg-primary/10' },
          { label: t('attendance_present'), value: monthStats.present, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
          { label: t('attendance_absent'), value: monthStats.absent, icon: XCircle, tone: 'text-red-700 bg-red-50' },
          { label: t('attendance_late'), value: monthStats.late, icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
        ].map((item) => <Card key={item.label} className="shadow-none"><CardContent className="flex items-center gap-3 p-4"><span className={`rounded-lg p-2 ${item.tone}`}><item.icon className="h-4 w-4" /></span><div><p className="text-2xl font-semibold">{item.value}</p><p className="text-xs text-muted-foreground">{item.label}</p></div></CardContent></Card>)}
      </div>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-base">{t('add_attendance')}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[auto_minmax(220px,1fr)]">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
              <div className="space-y-4">
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
                className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
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
            </div>
          </CardContent>
        </Card>
      <Card className="shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-base">{t('attendance_history')}</CardTitle><p className="text-xs text-muted-foreground">{selectedDate ? format(selectedDate, 'MMMM yyyy') : ''}</p></CardHeader>
        <CardContent>
          <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <p>{t('loading_attendance_records')}</p>
            ) : attendance.length === 0 ? (
              <p>{t('no_attendance_records')}</p>
            ) : (
              <div className="space-y-2">
                {attendance.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
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
                      {statusLabel(record.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
