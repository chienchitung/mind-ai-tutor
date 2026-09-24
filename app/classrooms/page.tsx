'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Beaker,
  Check,
  ClipboardCopy,
  Gamepad2,
  GraduationCap,
  Plus,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-state';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface Classroom {
  id: string;
  name: string;
  academic_year: string | null;
  term: string | null;
  description: string | null;
  study_label: string | null;
  study_arm: string | null;
  status: 'active' | 'archived';
}

interface Student {
  id: string;
  name: string;
  email: string;
  grade: number | null;
  status: string;
}

interface Game {
  id: string;
  title: string;
}

interface Membership {
  classroom_id: string;
  student_id: string;
  left_at: string | null;
}

interface GameAssignment {
  id: string;
  classroom_id: string;
  game_id: string;
  title: string | null;
  status: 'draft' | 'active' | 'closed' | 'archived';
  assigned_at: string;
  due_at: string | null;
}

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [assignments, setAssignments] = useState<GameAssignment[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [className, setClassName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [studyLabel, setStudyLabel] = useState('');
  const [studyArm, setStudyArm] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [copiedAssignmentId, setCopiedAssignmentId] = useState<string | null>(null);
  const { toast } = useToast();
  const { language } = useLanguage();
  const zh = language === 'zh-TW';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const client = supabase() as any;
      const [classroomsResult, studentsResult, gamesResult, membershipsResult, assignmentsResult] = await Promise.all([
        client.from('classrooms').select('*').order('created_at', { ascending: false }),
        client.from('students').select('id, name, email, grade, status').order('name'),
        client.from('digital_games').select('id, title').order('title'),
        client.from('classroom_students').select('classroom_id, student_id, left_at'),
        client.from('game_assignments').select('*').order('assigned_at', { ascending: false }),
      ]);

      const error = classroomsResult.error || studentsResult.error || gamesResult.error
        || membershipsResult.error || assignmentsResult.error;
      if (error) throw error;

      const nextClassrooms = classroomsResult.data || [];
      setClassrooms(nextClassrooms);
      setStudents(studentsResult.data || []);
      setGames(gamesResult.data || []);
      setMemberships(membershipsResult.data || []);
      setAssignments(assignmentsResult.data || []);
      setSelectedClassroomId(current =>
        current && nextClassrooms.some((item: Classroom) => item.id === current)
          ? current
          : nextClassrooms[0]?.id ?? null,
      );
    } catch (error: any) {
      console.error('Failed to load classrooms:', error);
      toast({
        title: zh ? '無法載入班級' : 'Could not load classrooms',
        description: error?.message || (zh ? '請確認資料庫更新已套用。' : 'Check that the database migration has been applied.'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedClassroom = classrooms.find(item => item.id === selectedClassroomId) ?? null;
  const activeMemberIds = useMemo(
    () => new Set(memberships
      .filter(item => item.classroom_id === selectedClassroomId && !item.left_at)
      .map(item => item.student_id)),
    [memberships, selectedClassroomId],
  );
  const classAssignments = assignments.filter(item => item.classroom_id === selectedClassroomId);

  async function createClassroom() {
    if (!className.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const client = supabase() as any;
      const { data, error } = await client.from('classrooms').insert({
        name: className.trim(),
        academic_year: academicYear.trim() || null,
        term: term.trim() || null,
        study_label: studyLabel.trim() || null,
        study_arm: studyArm.trim() || null,
      }).select('*').single();
      if (error) throw error;

      setClassName('');
      setAcademicYear('');
      setTerm('');
      setStudyLabel('');
      setStudyArm('');
      setShowCreate(false);
      await loadData();
      setSelectedClassroomId(data.id);
      toast({ title: zh ? '班級已建立' : 'Class created' });
    } catch (error: any) {
      toast({ title: zh ? '建立失敗' : 'Create failed', description: error?.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleMember(studentId: string, checked: boolean) {
    if (!selectedClassroomId) return;
    const before = memberships;
    if (checked) {
      setMemberships(current => [
        ...current.filter(item => !(item.classroom_id === selectedClassroomId && item.student_id === studentId)),
        { classroom_id: selectedClassroomId, student_id: studentId, left_at: null },
      ]);
    } else {
      const leftAt = new Date().toISOString();
      setMemberships(current => current.map(item =>
        item.classroom_id === selectedClassroomId && item.student_id === studentId
          ? { ...item, left_at: leftAt }
          : item,
      ));
    }

    try {
      const { supabase } = await import('@/lib/supabase');
      const client = supabase() as any;
      const query = checked
        ? client.from('classroom_students').upsert({ classroom_id: selectedClassroomId, student_id: studentId, left_at: null })
        : client.from('classroom_students').update({ left_at: new Date().toISOString() }).eq('classroom_id', selectedClassroomId).eq('student_id', studentId);
      const { error } = await query;
      if (error) throw error;
    } catch (error: any) {
      setMemberships(before);
      toast({ title: zh ? '無法更新學生名單' : 'Could not update roster', description: error?.message, variant: 'destructive' });
    }
  }

  async function assignGame() {
    if (!selectedClassroomId || !selectedGameId || isSaving) return;
    setIsSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const client = supabase() as any;
      const game = games.find(item => item.id === selectedGameId);
      const { error } = await client.from('game_assignments').insert({
        classroom_id: selectedClassroomId,
        game_id: selectedGameId,
        title: game?.title || null,
        status: 'active',
      });
      if (error) throw error;
      setSelectedGameId('');
      await loadData();
      toast({ title: zh ? '遊戲已指派給班級' : 'Game assigned to class' });
    } catch (error: any) {
      toast({ title: zh ? '指派失敗' : 'Assignment failed', description: error?.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveClassroom() {
    if (!selectedClassroom || isSaving) return;
    setIsSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await (supabase() as any)
        .from('classrooms')
        .update({ status: selectedClassroom.status === 'active' ? 'archived' : 'active', updated_at: new Date().toISOString() })
        .eq('id', selectedClassroom.id);
      if (error) throw error;
      await loadData();
    } catch (error: any) {
      toast({ title: zh ? '更新失敗' : 'Update failed', description: error?.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  function assignmentUrl(assignment: GameAssignment) {
    const configuredBase = process.env.NEXT_PUBLIC_GAME_ENGINE_URL?.replace(/\/$/, '');
    const base = configuredBase
      ? `${configuredBase}/games`
      : (typeof window !== 'undefined' ? `${window.location.origin}/games` : '/games');
    return `${base}/${assignment.game_id}?assignment=${assignment.id}`;
  }

  async function copyAssignmentLink(assignment: GameAssignment) {
    try {
      await navigator.clipboard.writeText(assignmentUrl(assignment));
      setCopiedAssignmentId(assignment.id);
      window.setTimeout(() => setCopiedAssignmentId(current => current === assignment.id ? null : current), 1800);
    } catch {
      toast({
        title: zh ? '無法複製連結' : 'Could not copy link',
        description: zh ? '請檢查瀏覽器的剪貼簿權限。' : 'Check the browser clipboard permission.',
        variant: 'destructive',
      });
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="w-full space-y-7 pb-10">
      <PageHeader
        heading={zh ? '班級與實驗分組' : 'Classes & experiment groups'}
        text={zh
          ? '建立固定學生群組，將同一款遊戲分別指派給不同班級，保留可比較的學習資料。'
          : 'Create stable cohorts and assign the same game separately so learning data remains comparable.'}
        actions={
          <Button onClick={() => setShowCreate(value => !value)}>
            <Plus className="mr-2 h-4 w-4" />
            {zh ? '新增班級' : 'New class'}
          </Button>
        }
      />

      {showCreate && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>{zh ? '建立班級' : 'Create class'}</CardTitle>
            <CardDescription>
              {zh ? '實驗名稱相同、實驗組別不同，即可建立實驗組與對照組。' : 'Use the same study name with different arms for control and intervention groups.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5 text-sm font-medium">
              {zh ? '班級名稱' : 'Class name'}
              <Input value={className} onChange={event => setClassName(event.target.value)} placeholder={zh ? '例如：六年甲班' : 'e.g. Grade 6A'} />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              {zh ? '學年度' : 'Academic year'}
              <Input value={academicYear} onChange={event => setAcademicYear(event.target.value)} placeholder="2026" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              {zh ? '學期' : 'Term'}
              <Input value={term} onChange={event => setTerm(event.target.value)} placeholder={zh ? '第一學期' : 'Term 1'} />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              {zh ? '實驗名稱（選填）' : 'Study name (optional)'}
              <Input value={studyLabel} onChange={event => setStudyLabel(event.target.value)} placeholder={zh ? 'AI 助教成效研究' : 'AI tutor study'} />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              {zh ? '實驗組別（選填）' : 'Study arm (optional)'}
              <Input value={studyArm} onChange={event => setStudyArm(event.target.value)} placeholder={zh ? '實驗組／對照組' : 'Intervention / Control'} />
            </label>
            <div className="flex gap-2 md:col-span-2 xl:col-span-5">
              <Button onClick={createClassroom} disabled={!className.trim() || isSaving}>{zh ? '建立班級' : 'Create class'}</Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>{zh ? '取消' : 'Cancel'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {classrooms.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
            <GraduationCap className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{zh ? '尚未建立班級' : 'No classes yet'}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {zh ? '先建立班級，再加入學生並指派遊戲。' : 'Create a class, add students, then assign a game.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            {classrooms.map(classroom => {
              const memberCount = memberships.filter(item => item.classroom_id === classroom.id && !item.left_at).length;
              const assignmentCount = assignments.filter(item => item.classroom_id === classroom.id && item.status === 'active').length;
              return (
                <button
                  key={classroom.id}
                  type="button"
                  onClick={() => setSelectedClassroomId(classroom.id)}
                  className={cn(
                    'w-full rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/40',
                    selectedClassroomId === classroom.id && 'border-primary ring-2 ring-primary/10',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{classroom.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[classroom.academic_year, classroom.term].filter(Boolean).join(' · ') || (zh ? '未設定學期' : 'No term set')}
                      </p>
                    </div>
                    {classroom.status === 'archived' && <Badge variant="secondary">{zh ? '已封存' : 'Archived'}</Badge>}
                  </div>
                  {classroom.study_arm && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                      <Beaker className="h-3.5 w-3.5" />
                      <span className="truncate">{classroom.study_arm}</span>
                    </div>
                  )}
                  <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                    <span>{memberCount} {zh ? '位學生' : 'students'}</span>
                    <span>{assignmentCount} {zh ? '個進行中活動' : 'active assignments'}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedClassroom && (
            <div className="min-w-0 space-y-6">
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle>{selectedClassroom.name}</CardTitle>
                    <CardDescription className="mt-1.5">
                      {selectedClassroom.study_label
                        ? `${selectedClassroom.study_label}${selectedClassroom.study_arm ? ` · ${selectedClassroom.study_arm}` : ''}`
                        : (zh ? '一般教學班級' : 'Standard teaching class')}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={archiveClassroom} disabled={isSaving}>
                    <Archive className="mr-2 h-4 w-4" />
                    {selectedClassroom.status === 'active' ? (zh ? '封存' : 'Archive') : (zh ? '重新啟用' : 'Reactivate')}
                  </Button>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />{zh ? '班級學生' : 'Class roster'}</CardTitle>
                  <CardDescription>{zh ? '勾選學生即可加入此班級；同一學生可以加入多個班級。' : 'Select students to add them. A student may belong to more than one class.'}</CardDescription>
                </CardHeader>
                <CardContent>
                  {students.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{zh ? '請先到學生管理新增學生。' : 'Add students in Student Management first.'}</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {students.map(student => (
                        <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-muted/40">
                          <Checkbox
                            checked={activeMemberIds.has(student.id)}
                            onCheckedChange={checked => void toggleMember(student.id, checked === true)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{student.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{student.email}</span>
                          </span>
                          {student.grade !== null && <Badge variant="outline">{student.grade}</Badge>}
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Gamepad2 className="h-5 w-5" />{zh ? '班級遊戲活動' : 'Class game assignments'}</CardTitle>
                  <CardDescription>
                    {zh ? '每次指派都會產生班級專屬連結；相同遊戲指派到兩個班級時，資料會分開記錄。' : 'Each assignment gets a class-specific link, keeping data separate when the same game is used by two classes.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={selectedGameId}
                      onChange={event => setSelectedGameId(event.target.value)}
                      aria-label={zh ? '選擇要指派的遊戲' : 'Choose a game to assign'}
                      className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">{zh ? '選擇要指派的遊戲' : 'Choose a game to assign'}</option>
                      {games.map(game => <option key={game.id} value={game.id}>{game.title}</option>)}
                    </select>
                    <Button onClick={assignGame} disabled={!selectedGameId || isSaving}>
                      <Plus className="mr-2 h-4 w-4" />{zh ? '建立活動' : 'Create assignment'}
                    </Button>
                  </div>

                  {classAssignments.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      {zh ? '尚未指派任何遊戲。' : 'No games assigned yet.'}
                    </div>
                  ) : classAssignments.map(assignment => {
                    const game = games.find(item => item.id === assignment.game_id);
                    return (
                      <div key={assignment.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{assignment.title || game?.title || (zh ? '未命名遊戲' : 'Untitled game')}</p>
                            <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>{assignment.status}</Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{assignmentUrl(assignment)}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => void copyAssignmentLink(assignment)}>
                          {copiedAssignmentId === assignment.id ? <Check className="mr-2 h-4 w-4" /> : <ClipboardCopy className="mr-2 h-4 w-4" />}
                          {copiedAssignmentId === assignment.id ? (zh ? '已複製' : 'Copied') : (zh ? '複製班級連結' : 'Copy class link')}
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
