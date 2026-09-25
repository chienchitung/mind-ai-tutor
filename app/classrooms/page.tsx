'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  AlertCircle,
  Check,
  ClipboardCopy,
  Gamepad2,
  GraduationCap,
  LockKeyhole,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  type LucideIcon,
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
import { PageLoader } from '@/components/ui/page-state';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  filterClassroomStudents,
  getRosterGrades,
  type RosterMembershipFilter,
} from '@/lib/classroom-roster';

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
  email: string | null;
  external_id: string | null;
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

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex min-h-24 items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-none tabular-nums text-foreground">{value}</p>
          <p className="mt-2 truncate text-sm text-muted-foreground">{label}</p>
        </div>
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', tone)} aria-hidden="true">
          <Icon size={19} strokeWidth={2} />
        </span>
      </CardContent>
    </Card>
  );
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
  const [showArchived, setShowArchived] = useState(false);
  const [showStoppedAssignments, setShowStoppedAssignments] = useState(false);
  const [showDeleteClassroom, setShowDeleteClassroom] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [className, setClassName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [studyLabel, setStudyLabel] = useState('');
  const [studyArm, setStudyArm] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [copiedAssignmentId, setCopiedAssignmentId] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterGrade, setRosterGrade] = useState('all');
  const [rosterMembership, setRosterMembership] = useState<RosterMembershipFilter>('all');
  const [isRosterSaving, setIsRosterSaving] = useState(false);
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
        client.from('students').select('id, name, email, external_id, grade, status').order('name'),
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
  const rosterGrades = useMemo(() => getRosterGrades(students), [students]);
  const filteredStudents = useMemo(
    () => filterClassroomStudents(students, activeMemberIds, {
      search: rosterSearch,
      grade: rosterGrade,
      membership: rosterMembership,
    }),
    [activeMemberIds, rosterGrade, rosterMembership, rosterSearch, students],
  );
  const otherClassroomsByStudent = useMemo(() => {
    const classroomNames = new Map(classrooms
      .filter(classroom => classroom.status === 'active')
      .map(classroom => [classroom.id, classroom.name]));
    const result = new Map<string, string[]>();
    memberships.forEach(membership => {
      if (membership.left_at || membership.classroom_id === selectedClassroomId) return;
      const classroomName = classroomNames.get(membership.classroom_id);
      if (!classroomName) return;
      result.set(membership.student_id, [...(result.get(membership.student_id) || []), classroomName]);
    });
    return result;
  }, [classrooms, memberships, selectedClassroomId]);
  const filteredEnrolledCount = filteredStudents.filter(student => activeMemberIds.has(student.id)).length;
  const filteredAddableStudents = filteredStudents.filter(student => student.status === 'active' && !activeMemberIds.has(student.id));
  const filteredAvailableCount = filteredAddableStudents.length;
  const hasActiveRosterFilter = Boolean(rosterSearch.trim()) || rosterGrade !== 'all' || rosterMembership !== 'all';
  const classAssignments = assignments
    .filter(item => item.classroom_id === selectedClassroomId)
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'));
  const stoppedAssignmentCount = classAssignments.filter(item => item.status !== 'active').length;
  const visibleClassAssignments = showStoppedAssignments
    ? classAssignments
    : classAssignments.filter(item => item.status === 'active');
  const activeAssignedGameIds = new Set(classAssignments
    .filter(item => item.status === 'active')
    .map(item => item.game_id));
  const availableGames = games.filter(game => !activeAssignedGameIds.has(game.id));
  const activeClassCount = classrooms.filter(item => item.status === 'active').length;
  const activeClassIds = new Set(classrooms.filter(item => item.status === 'active').map(item => item.id));
  const assignedStudentCount = new Set(memberships
    .filter(item => !item.left_at && activeClassIds.has(item.classroom_id))
    .map(item => item.student_id)).size;
  const activeAssignmentCount = assignments.filter(item => item.status === 'active' && activeClassIds.has(item.classroom_id)).length;
  const archivedClassCount = classrooms.length - activeClassCount;
  const visibleClassrooms = showArchived ? classrooms : classrooms.filter(item => item.status === 'active');

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

  async function updateMembers(studentIds: string[], checked: boolean) {
    if (!selectedClassroomId || selectedClassroom?.status !== 'active' || studentIds.length === 0 || isRosterSaving) return;
    setIsRosterSaving(true);
    const before = memberships;
    const studentIdSet = new Set(studentIds);
    if (checked) {
      setMemberships(current => [
        ...current.filter(item => !(item.classroom_id === selectedClassroomId && studentIdSet.has(item.student_id))),
        ...studentIds.map(studentId => ({ classroom_id: selectedClassroomId, student_id: studentId, left_at: null })),
      ]);
    } else {
      const leftAt = new Date().toISOString();
      setMemberships(current => current.map(item =>
        item.classroom_id === selectedClassroomId && studentIdSet.has(item.student_id)
          ? { ...item, left_at: leftAt }
          : item,
      ));
    }

    try {
      const { supabase } = await import('@/lib/supabase');
      const client = supabase() as any;
      const query = checked
        ? client.from('classroom_students').upsert(studentIds.map(studentId => ({ classroom_id: selectedClassroomId, student_id: studentId, left_at: null })))
        : client.from('classroom_students').update({ left_at: new Date().toISOString() }).eq('classroom_id', selectedClassroomId).in('student_id', studentIds);
      const { error } = await query;
      if (error) throw error;
      if (studentIds.length > 1) {
        toast({
          title: checked
            ? (zh ? `已加入 ${studentIds.length} 位學生` : `${studentIds.length} students added`)
            : (zh ? `已移出 ${studentIds.length} 位學生` : `${studentIds.length} students removed`),
        });
      }
    } catch (error: any) {
      setMemberships(before);
      toast({ title: zh ? '無法更新學生名單' : 'Could not update roster', description: error?.message, variant: 'destructive' });
    } finally {
      setIsRosterSaving(false);
    }
  }

  async function assignGame() {
    if (!selectedClassroomId || !selectedGameId || isSaving || selectedClassroom?.status !== 'active') return;
    if (activeAssignedGameIds.has(selectedGameId)) {
      toast({
        title: zh ? '這款遊戲已指派' : 'Game already assigned',
        description: zh ? '同一班級同一時間只保留一個活動連結。' : 'A class can only have one active link for each game.',
        variant: 'destructive',
      });
      return;
    }
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

  async function stopAssignment(assignment: GameAssignment) {
    if (assignment.status !== 'active' || isSaving) return;
    setIsSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await (supabase() as any)
        .from('game_assignments')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', assignment.id)
        .eq('status', 'active');
      if (error) throw error;
      await loadData();
      toast({
        title: zh ? '已停止指派' : 'Assignment stopped',
        description: zh ? '舊連結已停用，既有學習紀錄仍會保留。' : 'The old link is disabled and existing learning records are preserved.',
      });
    } catch (error: any) {
      toast({ title: zh ? '無法停止指派' : 'Could not stop assignment', description: error?.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveClassroom() {
    if (!selectedClassroom || isSaving) return;
    const wasActive = selectedClassroom.status === 'active';
    setIsSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await (supabase() as any)
        .from('classrooms')
        .update({ status: selectedClassroom.status === 'active' ? 'archived' : 'active', updated_at: new Date().toISOString() })
        .eq('id', selectedClassroom.id);
      if (error) throw error;
      await loadData();
      if (wasActive && !showArchived) {
        setSelectedClassroomId(classrooms.find(item => item.id !== selectedClassroom.id && item.status === 'active')?.id ?? null);
      }
    } catch (error: any) {
      toast({ title: zh ? '更新失敗' : 'Update failed', description: error?.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  async function permanentlyDeleteClassroom() {
    if (
      !selectedClassroom
      || selectedClassroom.status !== 'archived'
      || deleteConfirmationName.trim() !== selectedClassroom.name
      || isSaving
    ) return;
    setIsSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await (supabase() as any)
        .from('classrooms')
        .delete()
        .eq('id', selectedClassroom.id)
        .eq('status', 'archived');
      if (error) throw error;
      setShowDeleteClassroom(false);
      setDeleteConfirmationName('');
      setSelectedClassroomId(null);
      await loadData();
      toast({ title: zh ? '班級已永久移除' : 'Class permanently removed' });
    } catch (error: any) {
      toast({ title: zh ? '無法移除班級' : 'Could not remove class', description: error?.message, variant: 'destructive' });
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
    <div className="mx-auto w-full max-w-[1180px] min-w-0 space-y-6 pb-10">
      <PageHeader
        heading={zh ? '班級管理' : 'Class management'}
        text={zh
          ? '整理學生名單並指派學習遊戲；同一款遊戲可分別追蹤不同班級的表現。'
          : 'Organize rosters, assign learning games, and track each class separately.'}
        actions={classrooms.length > 0 ? (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {zh ? '新增班級' : 'New class'}
          </Button>
        ) : undefined}
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
          <CardContent className="grid p-0 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="flex flex-col justify-center px-6 py-8 sm:px-10 lg:py-10">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">{zh ? '從班級開始整理學習資料' : 'Organize learning data by class'}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {zh ? '將學生、遊戲活動與學習紀錄整理在一起，之後比較不同班級時，資料也不會混合。' : 'Keep rosters, game activities, and learning records together so class data stays separate.'}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />{zh ? '建立班級' : 'Create class'}</Button>
                {students.length === 0 && (
                  <Button variant="outline" asChild><Link href="/students/new"><UserPlus className="mr-2 h-4 w-4" />{zh ? '先新增學生' : 'Add students first'}</Link></Button>
                )}
              </div>
            </div>
            <div className="border-t bg-muted/25 px-6 py-7 sm:px-8 lg:border-l lg:border-t-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{zh ? '設定流程' : 'Setup flow'}</p>
                <h3 className="mt-1 text-base font-semibold">{zh ? '依序完成三項設定' : 'Complete these three steps'}</h3>
              </div>

              <ol className="mt-5 divide-y rounded-xl border bg-background">
                {[
                  {
                    title: zh ? '填寫基本資料' : 'Add class details',
                    description: zh ? '填寫班級名稱，學年度與學期可稍後補充。' : 'Add a class name; year and term can be completed later.',
                  },
                  {
                    title: zh ? '加入學生' : 'Add students',
                    description: zh ? '從既有學生名單勾選成員，不需要逐一建立帳號。' : 'Select learners from your roster without creating individual accounts.',
                  },
                  {
                    title: zh ? '指派並分享' : 'Assign and share',
                    description: zh ? '選擇遊戲後，將同一個班級活動連結分享給全班。' : 'Choose a game and share one class activity link with everyone.',
                  },
                ].map((step, index) => (
                  <li key={step.title} className="flex gap-3 px-4 py-3.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.description}</p>
                    </div>
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
            ].map(item => <SummaryCard key={item.label} {...item} />)}
          </section>
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            {visibleClassrooms.map(classroom => {
              const memberCount = memberships.filter(item => item.classroom_id === classroom.id && !item.left_at).length;
              const assignmentCount = assignments.filter(item => item.classroom_id === classroom.id && item.status === 'active').length;
              return (
                <button
                  key={classroom.id}
                  type="button"
                  onClick={() => {
                    setSelectedClassroomId(classroom.id);
                    setSelectedGameId('');
                    setShowStoppedAssignments(false);
                  }}
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
            {archivedClassCount > 0 && (
              <button
                type="button"
                onClick={() => setShowArchived(value => !value)}
                className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {showArchived
                  ? (zh ? '隱藏已封存班級' : 'Hide archived classes')
                  : (zh ? `查看已封存班級（${archivedClassCount}）` : `View archived classes (${archivedClassCount})`)}
              </button>
            )}
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
                  {selectedClassroom.status === 'active' ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isSaving}>
                          <Archive className="mr-2 h-4 w-4" />{zh ? '封存班級' : 'Archive class'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{zh ? `封存「${selectedClassroom.name}」？` : `Archive “${selectedClassroom.name}”?`}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {zh ? '封存後，學生會立即無法使用這個班級的活動連結登入。學生名單、遊戲活動與歷史學習紀錄仍會保留，重新啟用班級後可再次使用。' : 'Students immediately lose access to this class’s activity links. The roster, assignments, and learning history remain and become available again if you reactivate the class.'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{zh ? '取消' : 'Cancel'}</AlertDialogCancel>
                          <AlertDialogAction onClick={archiveClassroom}>{zh ? '確認封存' : 'Archive class'}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={archiveClassroom} disabled={isSaving}>
                        {zh ? '重新啟用班級' : 'Reactivate class'}
                      </Button>
                      <AlertDialog
                        open={showDeleteClassroom}
                        onOpenChange={open => {
                          setShowDeleteClassroom(open);
                          if (!open) setDeleteConfirmationName('');
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isSaving}>
                            <Trash2 className="mr-2 h-4 w-4" />{zh ? '永久移除' : 'Remove permanently'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{zh ? `永久刪除「${selectedClassroom.name}」？` : `Permanently delete “${selectedClassroom.name}”?`}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {zh
                                ? '這項操作無法復原。請先確認資料影響，再輸入班級名稱。'
                                : 'This action cannot be undone. Review the data impact, then enter the class name.'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-4">
                            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
                              <p className="font-semibold text-destructive">{zh ? '將永久刪除' : 'Permanently deleted'}</p>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                                <li>{zh ? '班級名稱與學生名單關係' : 'The class and roster relationships'}</li>
                                <li>{zh ? '所有班級活動連結與指派項目' : 'All class activity links and assignments'}</li>
                              </ul>
                              <p className="mt-3 font-semibold">{zh ? '仍會保留' : 'Still preserved'}</p>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                                <li>{zh ? '學生資料與既有學習紀錄' : 'Student profiles and existing learning records'}</li>
                                <li>{zh ? '但紀錄之後無法再依此班級篩選' : 'Records can no longer be filtered by this class'}</li>
                              </ul>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="delete-classroom-confirmation">
                                {zh ? `請輸入「${selectedClassroom.name}」確認刪除` : `Enter “${selectedClassroom.name}” to confirm`}
                              </Label>
                              <Input
                                id="delete-classroom-confirmation"
                                value={deleteConfirmationName}
                                onChange={event => setDeleteConfirmationName(event.target.value)}
                                placeholder={selectedClassroom.name}
                                autoComplete="off"
                              />
                            </div>
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{zh ? '保留班級' : 'Keep class'}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={permanentlyDeleteClassroom}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={deleteConfirmationName.trim() !== selectedClassroom.name || isSaving}
                            >
                              {isSaving
                                ? (zh ? '刪除中…' : 'Deleting…')
                                : (zh ? '永久刪除班級' : 'Delete class permanently')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardHeader>
              </Card>

              {selectedClassroom.status === 'archived' && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950" role="status">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{zh ? '這個班級目前已停止使用' : 'This class is currently inactive'}</p>
                    <p className="mt-1 text-sm text-amber-900/80">
                      {zh ? '學生無法用學號進入班級活動；名單與紀錄維持不變。若要繼續上課，請先重新啟用班級。' : 'Students cannot enter its activities with their ID. The roster and records remain unchanged; reactivate the class to resume.'}
                    </p>
                  </div>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 shrink-0" />{zh ? '學生名單' : 'Class roster'}</CardTitle>
                  <CardDescription>{zh ? `可用姓名、學號或 Email 搜尋，目前共 ${activeMemberIds.size} 位；移出班級仍會保留過去紀錄。` : `Search by name, student ID, or email. ${activeMemberIds.size} enrolled; removing one keeps their history.`}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {students.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{zh ? '請先到學生管理新增學生。' : 'Add students in Student Management first.'}</p>
                  ) : (
                    <>
                      <div className="grid gap-2 lg:grid-cols-[minmax(240px,1fr)_160px_180px]">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                          <Input
                            value={rosterSearch}
                            onChange={event => setRosterSearch(event.target.value)}
                            placeholder={zh ? '搜尋姓名、學號或 Email' : 'Search name, student ID, or email'}
                            aria-label={zh ? '搜尋學生' : 'Search students'}
                            className="pl-9"
                          />
                        </div>
                        <select
                          value={rosterGrade}
                          onChange={event => setRosterGrade(event.target.value)}
                          aria-label={zh ? '依年級篩選' : 'Filter by grade'}
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="all">{zh ? '所有年級' : 'All grades'}</option>
                          {rosterGrades.map(grade => <option key={grade} value={String(grade)}>{zh ? `${grade} 年級` : `Grade ${grade}`}</option>)}
                          {students.some(student => student.grade === null) && <option value="unassigned">{zh ? '未設定年級' : 'No grade'}</option>}
                        </select>
                        <select
                          value={rosterMembership}
                          onChange={event => setRosterMembership(event.target.value as RosterMembershipFilter)}
                          aria-label={zh ? '依分班狀態篩選' : 'Filter by enrollment'}
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="all">{zh ? '全部學生' : 'All students'}</option>
                          <option value="enrolled">{zh ? '已加入本班' : 'In this class'}</option>
                          <option value="available">{zh ? '尚未加入本班' : 'Not in this class'}</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-3 rounded-xl bg-muted/35 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground" aria-live="polite">
                          {zh
                            ? `找到 ${filteredStudents.length} 位；其中 ${filteredEnrolledCount} 位已加入本班`
                            : `${filteredStudents.length} found; ${filteredEnrolledCount} already in this class`}
                        </p>
                        {selectedClassroom.status === 'active' && hasActiveRosterFilter && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={filteredAvailableCount === 0 || isRosterSaving}
                              onClick={() => void updateMembers(filteredAddableStudents.map(student => student.id), true)}
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              {zh ? `加入顯示的學生（${filteredAvailableCount}）` : `Add shown (${filteredAvailableCount})`}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={filteredEnrolledCount === 0 || isRosterSaving}
                              onClick={() => void updateMembers(filteredStudents.filter(student => activeMemberIds.has(student.id)).map(student => student.id), false)}
                            >
                              {zh ? `移出顯示的學生（${filteredEnrolledCount}）` : `Remove shown (${filteredEnrolledCount})`}
                            </Button>
                          </div>
                        )}
                        {selectedClassroom.status === 'active' && !hasActiveRosterFilter && (
                          <p className="text-xs text-muted-foreground">
                            {zh ? '先搜尋或篩選，再使用批次加入與移出。' : 'Search or filter before using bulk actions.'}
                          </p>
                        )}
                      </div>

                      {filteredStudents.length === 0 ? (
                        <div className="rounded-xl border border-dashed px-4 py-8 text-center">
                          <p className="text-sm font-medium">{zh ? '找不到符合條件的學生' : 'No students match these filters'}</p>
                          <Button
                            variant="link"
                            size="sm"
                            className="mt-1 text-muted-foreground"
                            onClick={() => {
                              setRosterSearch('');
                              setRosterGrade('all');
                              setRosterMembership('all');
                            }}
                          >
                            {zh ? '清除篩選條件' : 'Clear filters'}
                          </Button>
                        </div>
                      ) : (
                        <div className="max-h-[520px] space-y-2 overflow-y-auto overscroll-contain pr-1">
                          {filteredStudents.map(student => {
                            const otherClassrooms = otherClassroomsByStudent.get(student.id) || [];
                            const enrolled = activeMemberIds.has(student.id);
                            const canChangeMembership = selectedClassroom.status === 'active'
                              && !isRosterSaving
                              && (student.status === 'active' || enrolled);
                            return (
                              <label
                                key={student.id}
                                className={cn(
                                  'grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]',
                                  canChangeMembership
                                    ? 'cursor-pointer hover:bg-muted/40'
                                    : 'cursor-not-allowed opacity-70',
                                  enrolled && 'border-primary/30 bg-primary/[0.03]',
                                )}
                              >
                                <Checkbox
                                  checked={enrolled}
                                  disabled={!canChangeMembership}
                                  onCheckedChange={checked => void updateMembers([student.id], checked === true)}
                                  aria-label={zh ? `${student.name} 加入本班` : `Add ${student.name} to this class`}
                                />
                                <span className="min-w-0">
                                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-medium">{student.name}</span>
                                    <span className="font-mono text-xs text-muted-foreground">
                                      {student.external_id || (zh ? '未設定學號' : 'No student ID')}
                                    </span>
                                    {student.status !== 'active' && <Badge variant="secondary">{zh ? '已停用' : 'Inactive'}</Badge>}
                                  </span>
                                  <span className="mt-1 block break-all text-xs text-muted-foreground">
                                    {student.email || (zh ? '未設定 Email' : 'No email')}
                                  </span>
                                  {otherClassrooms.length > 0 && (
                                    <span className="mt-1 block truncate text-xs text-muted-foreground" title={otherClassrooms.join('、')}>
                                      {zh ? `其他班級：${otherClassrooms.join('、')}` : `Other classes: ${otherClassrooms.join(', ')}`}
                                    </span>
                                  )}
                                </span>
                                <span className="flex items-center gap-2 pl-8 sm:pl-0">
                                  {student.grade !== null && <Badge variant="outline">{zh ? `${student.grade} 年級` : `Grade ${student.grade}`}</Badge>}
                                  {enrolled && <Badge>{zh ? '本班' : 'This class'}</Badge>}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Gamepad2 className="h-5 w-5 shrink-0" />{zh ? '班級遊戲活動' : 'Class game assignments'}</CardTitle>
                  <CardDescription>
                    {zh ? '每款遊戲同時只會有一個進行中連結，避免重複指派。停止指派不會刪除既有學習紀錄。' : 'Each game has one active link at a time to prevent duplicates. Stopping an assignment keeps its learning history.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={selectedGameId}
                      onChange={event => setSelectedGameId(event.target.value)}
                      disabled={selectedClassroom.status !== 'active'}
                      aria-label={zh ? '選擇要指派的遊戲' : 'Choose a game to assign'}
                      className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">{zh ? '選擇要指派的遊戲' : 'Choose a game to assign'}</option>
                      {availableGames.map(game => <option key={game.id} value={game.id}>{game.title}</option>)}
                    </select>
                    <Button onClick={assignGame} disabled={!selectedGameId || isSaving || selectedClassroom.status !== 'active'}>
                      <Plus className="mr-2 h-4 w-4" />{zh ? '指派遊戲' : 'Assign game'}
                    </Button>
                  </div>

                  {selectedClassroom.status === 'active' && availableGames.length === 0 && games.length > 0 && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />{zh ? '所有遊戲都已指派；若要重新建立連結，請先停止原有指派。' : 'All games are assigned. Stop an existing assignment before creating a new link.'}
                    </p>
                  )}

                  {visibleClassAssignments.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      {classAssignments.length === 0
                        ? (zh ? '尚未指派任何遊戲。' : 'No games assigned yet.')
                        : (zh ? '目前沒有進行中的遊戲活動。' : 'There are no active game assignments.')}
                    </div>
                  ) : visibleClassAssignments.map(assignment => {
                    const game = games.find(item => item.id === assignment.game_id);
                    return (
                      <div key={assignment.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{assignment.title || game?.title || (zh ? '未命名遊戲' : 'Untitled game')}</p>
                            <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>
                              {assignment.status === 'active' ? (zh ? '進行中' : 'Active') : (zh ? '已停止' : 'Stopped')}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{assignmentUrl(assignment)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={assignment.status !== 'active' || selectedClassroom.status !== 'active'}
                            onClick={() => void copyAssignmentLink(assignment)}
                          >
                            {copiedAssignmentId === assignment.id ? <Check className="mr-2 h-4 w-4" /> : <ClipboardCopy className="mr-2 h-4 w-4" />}
                            {copiedAssignmentId === assignment.id ? (zh ? '已複製' : 'Copied') : (zh ? '複製活動連結' : 'Copy link')}
                          </Button>
                          {assignment.status === 'active' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isSaving || selectedClassroom.status !== 'active'}>
                                  <Trash2 className="mr-2 h-4 w-4" />{zh ? '停止指派' : 'Stop assignment'}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{zh ? '停止這個遊戲指派？' : 'Stop this game assignment?'}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {zh ? '學生將無法再使用這個活動連結。既有進度與學習紀錄會保留，之後也可以重新指派同一款遊戲。' : 'Students can no longer use this activity link. Existing progress and records remain, and you can assign the game again later.'}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{zh ? '保留活動' : 'Keep activity'}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => void stopAssignment(assignment)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    {zh ? '停止指派' : 'Stop assignment'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {stoppedAssignmentCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => setShowStoppedAssignments(value => !value)}
                    >
                      {showStoppedAssignments
                        ? (zh ? '收起已停止活動' : 'Hide stopped assignments')
                        : (zh ? `查看已停止活動（${stoppedAssignmentCount}）` : `View stopped assignments (${stoppedAssignmentCount})`)}
                    </Button>
                  )}
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
