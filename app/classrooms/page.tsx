'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Check,
  ClipboardCopy,
  Gamepad2,
  GraduationCap,
  Plus,
  UserPlus,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const activeClassCount = classrooms.filter(item => item.status === 'active').length;
  const assignedStudentCount = new Set(memberships.filter(item => !item.left_at).map(item => item.student_id)).size;
  const activeAssignmentCount = assignments.filter(item => item.status === 'active').length;

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
    <div className="w-full min-w-0 space-y-6 pb-10">
      <PageHeader
        heading={zh ? '班級管理' : 'Class management'}
        text={zh
          ? '整理學生名單並指派學習遊戲；同一款遊戲可分別追蹤不同班級的表現。'
          : 'Organize rosters, assign learning games, and track each class separately.'}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {zh ? '新增班級' : 'New class'}
          </Button>
        }
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{zh ? '建立班級' : 'Create class'}</DialogTitle>
            <DialogDescription>
              {zh ? '先填寫基本資料，建立後再加入學生與指派遊戲。' : 'Enter the basics first, then add students and assign games.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-1">
            <div className="space-y-2">
              <Label htmlFor="class-name">{zh ? '班級名稱' : 'Class name'} <span className="text-destructive">*</span></Label>
              <Input id="class-name" autoFocus value={className} onChange={event => setClassName(event.target.value)} placeholder={zh ? '例如：六年甲班' : 'e.g. Grade 6A'} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="academic-year">{zh ? '學年度（選填）' : 'Academic year (optional)'}</Label>
                <Input id="academic-year" value={academicYear} onChange={event => setAcademicYear(event.target.value)} placeholder="2026" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="term">{zh ? '學期（選填）' : 'Term (optional)'}</Label>
                <Input id="term" value={term} onChange={event => setTerm(event.target.value)} placeholder={zh ? '第一學期' : 'Term 1'} />
              </div>
            </div>
            <details className="rounded-xl border bg-muted/20 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">{zh ? '進階標記（選填）' : 'Advanced labels (optional)'}</summary>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {zh ? '只有需要標記研究或比較組別時才需填寫，日常班級可略過。' : 'Only use these fields when labeling a study or comparison group.'}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="study-label">{zh ? '比較名稱' : 'Comparison name'}</Label>
                  <Input id="study-label" value={studyLabel} onChange={event => setStudyLabel(event.target.value)} placeholder={zh ? '例如：六年級學習比較' : 'e.g. Grade 6 comparison'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="study-arm">{zh ? '組別標記' : 'Group label'}</Label>
                  <Input id="study-arm" value={studyArm} onChange={event => setStudyArm(event.target.value)} placeholder={zh ? '例如：甲班／乙班' : 'e.g. Class A / Class B'} />
                </div>
              </div>
            </details>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={isSaving}>{zh ? '取消' : 'Cancel'}</Button>
            <Button onClick={createClassroom} disabled={!className.trim() || isSaving}>
              {isSaving ? (zh ? '建立中…' : 'Creating…') : (zh ? '建立班級' : 'Create class')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {classrooms.length === 0 ? (
        <Card className="overflow-hidden">
          <CardContent className="grid p-0 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:py-12">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">{zh ? '建立第一個班級' : 'Create your first class'}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {zh ? '將學生、遊戲活動與學習紀錄整理在一起，之後比較不同班級時，資料也不會混合。' : 'Keep rosters, game activities, and learning records together so class data stays separate.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />{zh ? '建立班級' : 'Create class'}</Button>
                {students.length === 0 && (
                  <Button variant="outline" asChild><Link href="/students/new"><UserPlus className="mr-2 h-4 w-4" />{zh ? '先新增學生' : 'Add students first'}</Link></Button>
                )}
              </div>
            </div>
            <div className="border-t bg-muted/25 px-6 py-8 sm:px-8 lg:border-l lg:border-t-0">
              <p className="text-sm font-semibold">{zh ? '開始使用只要三步' : 'Get started in three steps'}</p>
              <ol className="mt-5 space-y-5">
                {[
                  zh ? '建立班級與學期資料' : 'Create the class and term',
                  zh ? '從學生名單勾選班級成員' : 'Select students for the roster',
                  zh ? '指派遊戲並分享班級連結' : 'Assign a game and share its link',
                ].map((step, index) => (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <section aria-label={zh ? '班級摘要' : 'Class summary'} className="grid gap-3 sm:grid-cols-3">
            {[
              { label: zh ? '進行中班級' : 'Active classes', value: activeClassCount, icon: GraduationCap, tone: 'bg-blue-50 text-blue-700' },
              { label: zh ? '已分班學生' : 'Students assigned', value: assignedStudentCount, icon: Users, tone: 'bg-emerald-50 text-emerald-700' },
              { label: zh ? '進行中活動' : 'Active activities', value: activeAssignmentCount, icon: Gamepad2, tone: 'bg-violet-50 text-violet-700' },
            ].map(item => (
              <Card key={item.label}>
                <CardContent className="flex items-center gap-4 p-4">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', item.tone)}>
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-2xl font-semibold leading-none">{item.value}</span>
                    <span className="mt-1.5 block text-xs text-muted-foreground">{item.label}</span>
                  </span>
                </CardContent>
              </Card>
            ))}
          </section>
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
                    <Badge variant="outline" className="mt-3 max-w-full truncate font-normal">{classroom.study_arm}</Badge>
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
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />{zh ? '學生名單' : 'Class roster'}</CardTitle>
                  <CardDescription>{zh ? `勾選要加入的學生，目前共 ${activeMemberIds.size} 位；移出班級仍會保留過去紀錄。` : `Select students to add. ${activeMemberIds.size} enrolled; removing one keeps their history.`}</CardDescription>
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
                      <Plus className="mr-2 h-4 w-4" />{zh ? '指派遊戲' : 'Assign game'}
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
                          {copiedAssignmentId === assignment.id ? (zh ? '已複製' : 'Copied') : (zh ? '複製學生連結' : 'Copy student link')}
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
