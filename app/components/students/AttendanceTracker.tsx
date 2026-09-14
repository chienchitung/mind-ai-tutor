'use client';

import { useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { CalendarCheck, CheckCircle2, Clock3, PencilLine, Save, XCircle } from 'lucide-react';
import { supabase as getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface Attendance {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  notes?: string | null;
}

interface AttendanceTrackerProps {
  studentId: string;
}

const STATUS_STYLES: Record<Attendance['status'], string> = {
  present: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  absent: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
  late: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
};

export function AttendanceTracker({ studentId }: AttendanceTrackerProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const { toast } = useToast();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedStatus, setSelectedStatus] = useState<Attendance['status']>('present');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', studentId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;

        const dailyRecords = new Map<string, Attendance>();
        (data as Attendance[]).forEach((record) => {
          if (!dailyRecords.has(record.date)) dailyRecords.set(record.date, record);
        });
        setAttendance(Array.from(dailyRecords.values()));
      } catch (error) {
        console.error('Failed to fetch attendance:', error);
        toast({ title: t('error'), description: t('failed_fetch_attendance'), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    void fetchAttendance();
  }, [studentId, t, toast]);

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedRecord = attendance.find((record) => record.date === selectedDateKey);

  useEffect(() => {
    setSelectedStatus(selectedRecord?.status ?? 'present');
    setNotes(selectedRecord?.notes ?? '');
  }, [selectedDateKey, selectedRecord]);

  const monthRecords = useMemo(() => {
    if (!selectedDate) return [];
    const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
    return attendance.filter((record) => record.date >= start && record.date <= end);
  }, [attendance, selectedDate]);

  const monthStats = useMemo(() => ({
    total: monthRecords.length,
    present: monthRecords.filter((record) => record.status === 'present').length,
    absent: monthRecords.filter((record) => record.status === 'absent').length,
    late: monthRecords.filter((record) => record.status === 'late').length,
  }), [monthRecords]);

  const attendanceRate = monthStats.total > 0
    ? Math.round((monthStats.present / monthStats.total) * 100)
    : 0;

  const statusLabel = (status: Attendance['status']) => ({
    present: t('attendance_present'),
    absent: t('attendance_absent'),
    late: t('attendance_late'),
  })[status];

  const displayDate = (date: Date) => new Intl.DateTimeFormat(
    language === 'zh-TW' ? 'zh-TW' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  ).format(date);
  const displayStoredDate = (date: string) => displayDate(new Date(`${date}T00:00:00`));

  const handleSubmit = async () => {
    if (!selectedDate) return;
    setSubmitting(true);

    const payload = {
      student_id: studentId,
      date: selectedDateKey,
      status: selectedStatus,
      notes: notes.trim() || null,
    };

    try {
      const supabase = getSupabaseClient();
      const query = selectedRecord
        ? supabase.from('attendance').update(payload).eq('id', selectedRecord.id)
        : supabase.from('attendance').insert([payload]);
      const { data, error } = await query.select().single();
      if (error) throw error;

      const savedRecord = data as Attendance;
      setAttendance((previous) => [
        savedRecord,
        ...previous.filter((record) => record.date !== savedRecord.date),
      ].sort((a, b) => b.date.localeCompare(a.date)));
      toast({
        title: t('success'),
        description: language === 'zh-TW'
          ? selectedRecord ? '出席紀錄已更新。' : '出席紀錄已新增。'
          : selectedRecord ? 'Attendance record updated.' : 'Attendance record added.',
      });
    } catch (error) {
      console.error('Failed to save attendance:', error);
      toast({ title: t('error'), description: t('failed_add_attendance'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const metrics = [
    { label: language === 'zh-TW' ? '本月出席率' : 'Attendance rate', value: `${attendanceRate}%`, icon: CalendarCheck, tone: 'text-primary bg-primary/10' },
    { label: t('attendance_present'), value: monthStats.present, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
    { label: t('attendance_absent'), value: monthStats.absent, icon: XCircle, tone: 'text-red-700 bg-red-50' },
    { label: t('attendance_late'), value: monthStats.late, icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <Card key={item.label} className="min-w-0 shadow-none">
            <CardContent className="flex min-h-[76px] min-w-0 items-center gap-3 p-4 pt-4 md:p-4 md:pt-4">
              <span className={`shrink-0 rounded-lg p-2 ${item.tone}`}><item.icon className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="text-2xl font-semibold leading-tight">{item.value}</p><p className="truncate text-xs leading-5 text-muted-foreground">{item.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card className="min-w-0 overflow-hidden shadow-none">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">{selectedRecord
              ? language === 'zh-TW' ? '編輯出席紀錄' : 'Edit attendance'
              : t('add_attendance')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{language === 'zh-TW' ? '選擇日期後設定學生當天的出席狀態。' : 'Choose a date, then set the student’s attendance status.'}</p>
          </CardHeader>
          <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5 md:pt-5">
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
              <div className="min-w-0">
                <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{language === 'zh-TW' ? '選擇日期' : 'Select date'}</Label>
                <Calendar
                  mode="single"
                  locale={language === 'zh-TW' ? zhTW : undefined}
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="w-full max-w-full rounded-xl bg-muted/35 p-4"
                  classNames={{
                    month: 'w-full space-y-3',
                    month_grid: 'mx-auto w-full max-w-[280px] border-collapse space-y-1',
                    nav: 'absolute inset-x-3 top-0 flex items-center justify-between',
                  }}
                />
              </div>

              <div className="min-w-0 space-y-5">
                <div>
                  <p className="text-sm font-semibold">{selectedDate ? displayDate(selectedDate) : '—'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedRecord
                    ? language === 'zh-TW' ? '這一天已有紀錄，儲存後會更新原紀錄。' : 'This date has a record. Saving will update it.'
                    : language === 'zh-TW' ? '這一天尚未登記。' : 'No attendance has been recorded for this date.'}</p>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">{language === 'zh-TW' ? '出席狀態' : 'Attendance status'}</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {(['present', 'absent', 'late'] as const).map((status) => (
                      <Button key={status} type="button" variant="outline" aria-pressed={selectedStatus === status} className={selectedStatus === status ? STATUS_STYLES[status] : ''} onClick={() => setSelectedStatus(status)}>
                        {statusLabel(status)}
                      </Button>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-2">
                  <Label htmlFor="attendance-notes">{language === 'zh-TW' ? '備註' : 'Notes'} <span className="font-normal text-muted-foreground">({language === 'zh-TW' ? '選填' : 'optional'})</span></Label>
                  <Textarea id="attendance-notes" className="min-h-24 resize-y" placeholder={language === 'zh-TW' ? '例如：事假、交通延誤或補課說明' : 'For example: leave, transport delay, or make-up class'} value={notes} onChange={(event) => setNotes(event.target.value)} />
                </div>

                <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={!selectedDate || submitting}>
                  <Save className="mr-2 h-4 w-4" />
                  {submitting
                    ? language === 'zh-TW' ? '儲存中…' : 'Saving…'
                    : selectedRecord
                      ? language === 'zh-TW' ? '更新出席紀錄' : 'Update attendance'
                      : t('add_attendance')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden shadow-none">
          <CardHeader className="border-b pb-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0"><CardTitle className="text-base">{t('attendance_history')}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{selectedDate ? new Intl.DateTimeFormat(language === 'zh-TW' ? 'zh-TW' : 'en-US', { year: 'numeric', month: 'long' }).format(selectedDate) : ''}</p></div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{language === 'zh-TW' ? `${monthRecords.length} 筆` : `${monthRecords.length} records`}</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-4 md:pt-4">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('loading_attendance_records')}</p>
            ) : monthRecords.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center"><CalendarCheck className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium">{language === 'zh-TW' ? '本月尚無出席紀錄' : 'No attendance this month'}</p><p className="mt-1 text-xs text-muted-foreground">{language === 'zh-TW' ? '從左側選擇日期即可新增。' : 'Choose a date to add the first record.'}</p></div>
            ) : (
              <div className="max-h-[472px] space-y-2 overflow-y-auto pr-1">
                {monthRecords.map((record) => (
                  <div key={record.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{displayStoredDate(record.date)}</p>{record.notes ? <p className="mt-1 truncate text-xs text-muted-foreground">{record.notes}</p> : null}</div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[record.status]}`}>{statusLabel(record.status)}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={language === 'zh-TW' ? `編輯 ${displayStoredDate(record.date)}` : `Edit ${displayStoredDate(record.date)}`} onClick={() => setSelectedDate(new Date(`${record.date}T00:00:00`))}><PencilLine className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
