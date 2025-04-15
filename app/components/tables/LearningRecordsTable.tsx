'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/types/supabase';

// Hardcoded values from .env.local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface LearningRecord {
  id: number;
  student_id: string;
  student_name: string;
  lesson_id: number;
  started_at_taipei: string;
  completed_at_taipei: string | null;
  time_spent_seconds: number;
}

interface LessonInfo {
  title: string;
  category: string;
  level: string;
}

// Helper function to get lesson info 
function getLessonInfo(lessonId: number): LessonInfo {
  // This would normally be fetched from a database
  // For now, we'll use a simple mapping
  const lessonMap: Record<number, LessonInfo> = {
    1: { title: 'JavaScript Fundamentals', category: 'Programming', level: 'Beginner' },
    2: { title: 'Python for Data Science', category: 'Data Science', level: 'Intermediate' },
    3: { title: 'Web Development with React', category: 'Web Development', level: 'Advanced' },
    4: { title: 'Introduction to Algorithms', category: 'Computer Science', level: 'Intermediate' },
    5: { title: 'Database Design', category: 'Database', level: 'Intermediate' },
  };
  
  return lessonMap[lessonId] || { title: `Lesson ${lessonId}`, category: 'Unknown', level: 'Unknown' };
}

// Helper function to format duration in seconds to readable format
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export function LearningRecordsTable() {
  const [learningRecords, setLearningRecords] = useState<LearningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  
  // Use direct Supabase client
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  });

  useEffect(() => {
    async function fetchLearningRecords() {
      try {
        // This is a mock implementation since we don't have learning_records_view
        // In a real app, we would query Supabase
        console.log("Fetching learning records using URL:", SUPABASE_URL);
        
        // Synthetic data
        setLearningRecords([
          {
            id: 1,
            student_id: '1',
            student_name: '王小明',
            lesson_id: 1,
            started_at_taipei: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            completed_at_taipei: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            time_spent_seconds: 3600
          },
          {
            id: 2,
            student_id: '2',
            student_name: '張同學',
            lesson_id: 2,
            started_at_taipei: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            completed_at_taipei: null,
            time_spent_seconds: 1800
          },
          {
            id: 3,
            student_id: '3',
            student_name: '李小明',
            lesson_id: 3,
            started_at_taipei: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            completed_at_taipei: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            time_spent_seconds: 3840
          },
          {
            id: 4,
            student_id: '4',
            student_name: '陳明明',
            lesson_id: 1,
            started_at_taipei: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            completed_at_taipei: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
            time_spent_seconds: 7200
          },
          {
            id: 5,
            student_id: '5',
            student_name: '林小華',
            lesson_id: 4,
            started_at_taipei: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            completed_at_taipei: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
            time_spent_seconds: 10800
          }
        ]);
      } catch (error) {
        console.error('Error fetching learning records:', error);
        toast({
          title: 'Error',
          description: 'Failed to load learning records',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchLearningRecords();
  }, [toast]);

  // Filter records based on search query
  const filteredRecords = learningRecords.filter(record => 
    record.student_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-4">Loading learning records...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Learning Records</h2>
        <div className="relative w-64">
          <Input
            placeholder="Search by student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Lesson</TableHead>
              <TableHead>Started At</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time Spent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  No learning records found
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record) => {
                const lessonInfo = getLessonInfo(record.lesson_id);
                
                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.student_name}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{lessonInfo.title}</div>
                        <div className="text-xs text-muted-foreground">{lessonInfo.category} - {lessonInfo.level}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(record.started_at_taipei), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      {record.completed_at_taipei ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          In Progress
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>{formatDuration(record.time_spent_seconds)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 