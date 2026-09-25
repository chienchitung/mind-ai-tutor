export interface ClassroomRosterStudent {
  id: string;
  name: string;
  email: string | null;
  external_id: string | null;
  grade: number | null;
  status: string;
}

export type RosterMembershipFilter = 'all' | 'enrolled' | 'available';

export interface ClassroomRosterFilters {
  search: string;
  grade: string;
  membership: RosterMembershipFilter;
}

function searchableStudentText(student: ClassroomRosterStudent) {
  return [student.name, student.external_id, student.email]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

export function filterClassroomStudents(
  students: ClassroomRosterStudent[],
  activeMemberIds: Set<string>,
  filters: ClassroomRosterFilters,
) {
  const search = filters.search.trim().toLocaleLowerCase();

  return students.filter(student => {
    if (search && !searchableStudentText(student).includes(search)) return false;
    if (filters.grade === 'unassigned' && student.grade !== null) return false;
    if (filters.grade !== 'all' && filters.grade !== 'unassigned' && String(student.grade) !== filters.grade) return false;

    const enrolled = activeMemberIds.has(student.id);
    if (filters.membership === 'enrolled' && !enrolled) return false;
    if (filters.membership === 'available' && enrolled) return false;
    return true;
  });
}

export function getRosterGrades(students: ClassroomRosterStudent[]) {
  return Array.from(new Set(students.flatMap(student => student.grade === null ? [] : [student.grade])))
    .sort((a, b) => a - b);
}
