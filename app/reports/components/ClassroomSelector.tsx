'use client';

import { GraduationCap } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const ALL_CLASSROOMS = 'all';
export const UNGROUPED_STUDENTS = 'ungrouped';

interface ClassroomSelectorProps {
  classrooms: { id: string; name: string; studyArm?: string | null }[];
  selectedClassroom: string;
  onSelectClassroom: (classroomId: string) => void;
  chinese: boolean;
}

export function ClassroomSelector({ classrooms, selectedClassroom, onSelectClassroom, chinese }: ClassroomSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <GraduationCap className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedClassroom} onValueChange={onSelectClassroom}>
        <SelectTrigger className="w-[210px]">
          <SelectValue placeholder={chinese ? '選擇班級' : 'Select class'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CLASSROOMS}>{chinese ? '所有學生' : 'All students'}</SelectItem>
          {classrooms.map(classroom => (
            <SelectItem key={classroom.id} value={classroom.id}>
              {classroom.name}{classroom.studyArm ? ` · ${classroom.studyArm}` : ''}
            </SelectItem>
          ))}
          <SelectItem value={UNGROUPED_STUDENTS}>{chinese ? '尚未分班' : 'Not assigned to a class'}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
