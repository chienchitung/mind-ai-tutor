'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentProgressChart } from '@/components/charts/StudentProgressChart';
import { getStudentProgress } from '@/lib/analytics';

interface Progress {
  id: string;
  created_at: string;
  subject: string;
  score: number;
  notes: string;
}

interface ProgressHistoryProps {
  studentId: string;
}

export function ProgressHistory({ studentId }: ProgressHistoryProps) {
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>();

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const data = await getStudentProgress(studentId);
        setProgress(data);
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [studentId]);

  const subjects = Array.from(new Set(progress.map((p) => p.subject)));

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Loading progress data...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (progress.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>No progress entries yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Add progress entries to track this student's performance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <select
          className="rounded-md border p-2"
          value={selectedSubject || ''}
          onChange={(e) =>
            setSelectedSubject(e.target.value || undefined)
          }
        >
          <option value="">All Subjects</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </div>

      <StudentProgressChart
        progress={progress}
        subject={selectedSubject}
      />

      <Card>
        <CardHeader>
          <CardTitle>Progress History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {progress
                .filter((p) =>
                  selectedSubject ? p.subject === selectedSubject : true
                )
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                )
                .map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {format(new Date(entry.created_at), 'PPP')}
                    </TableCell>
                    <TableCell>{entry.subject}</TableCell>
                    <TableCell>{entry.score}%</TableCell>
                    <TableCell>{entry.notes}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
} 