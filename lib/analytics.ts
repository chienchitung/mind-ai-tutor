import type { Database } from '@/types/supabase';

type Student = Database['public']['Tables']['students']['Row'];

interface Progress {
  id: string;
  created_at: string;
  student_id: string;
  subject: string;
  score: number;
  notes: string;
}

interface SubjectStats {
  totalScore: number;
  count: number;
  scores: number[];
}

interface ClassSubjectPerformance {
  averageScore: number;
  totalEntries: number;
}

export async function getStudentProgress(studentId: string): Promise<Progress[]> {
  // 動態導入 supabase 函數
  const { supabase } = await import('@/lib/supabase');
  const supabaseClient = supabase();
  
  const { data, error } = await supabaseClient
    .from('progress')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to fetch student progress');
  }

  return data as Progress[];
}

export async function addProgressEntry(
  studentId: string,
  subject: string,
  score: number,
  notes: string
): Promise<Progress> {
  // 動態導入 supabase 函數
  const { supabase } = await import('@/lib/supabase');
  const supabaseClient = supabase();
  
  const { data, error } = await supabaseClient
    .from('progress')
    .insert([
      {
        student_id: studentId,
        subject,
        score,
        notes,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error('Failed to add progress entry');
  }

  return data as Progress;
}

export async function getStudentStats(studentId: string) {
  const progress = await getStudentProgress(studentId);

  const subjectStats = progress.reduce((acc, entry) => {
    if (!acc[entry.subject]) {
      acc[entry.subject] = {
        totalScore: 0,
        count: 0,
        scores: [],
      };
    }

    acc[entry.subject].totalScore += entry.score;
    acc[entry.subject].count += 1;
    acc[entry.subject].scores.push(entry.score);

    return acc;
  }, {} as Record<string, SubjectStats>);

  return Object.entries(subjectStats).map(([subject, stats]) => ({
    subject,
    averageScore: stats.totalScore / stats.count,
    totalEntries: stats.count,
    trend: calculateTrend(stats.scores),
  }));
}

function calculateTrend(scores: number[]): 'improving' | 'declining' | 'stable' {
  if (scores.length < 2) return 'stable';

  const recentScores = scores.slice(-3); // Look at last 3 scores
  const firstScore = recentScores[0];
  const lastScore = recentScores[recentScores.length - 1];

  const difference = lastScore - firstScore;
  const threshold = 5; // 5% difference threshold

  if (difference > threshold) return 'improving';
  if (difference < -threshold) return 'declining';
  return 'stable';
}

export async function getClassStats() {
  // 動態導入 supabase 函數
  const { supabase } = await import('@/lib/supabase');
  const supabaseClient = supabase();
  
  const { data: students, error: studentsError } = await supabaseClient
    .from('students')
    .select('*');

  if (studentsError) {
    throw new Error('Failed to fetch students');
  }

  const { data: progress, error: progressError } = await supabaseClient
    .from('progress')
    .select('*');

  if (progressError) {
    throw new Error('Failed to fetch progress data');
  }

  const classStats = {
    totalStudents: students.length,
    activeStudents: students.filter((s) => s.status === 'active').length,
    subjectPerformance: {} as Record<string, ClassSubjectPerformance>,
  };

  // Calculate average scores per subject
  (progress as Progress[]).forEach((entry) => {
    if (!classStats.subjectPerformance[entry.subject]) {
      classStats.subjectPerformance[entry.subject] = {
        averageScore: 0,
        totalEntries: 0,
      };
    }

    classStats.subjectPerformance[entry.subject].averageScore += entry.score;
    classStats.subjectPerformance[entry.subject].totalEntries += 1;
  });

  // Calculate final averages
  Object.keys(classStats.subjectPerformance).forEach((subject) => {
    const stats = classStats.subjectPerformance[subject];
    stats.averageScore = stats.averageScore / stats.totalEntries;
  });

  return classStats;
} 