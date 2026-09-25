import { describe, expect, it } from 'vitest';
import { filterClassroomStudents, getRosterGrades, type ClassroomRosterStudent } from './classroom-roster';

const students: ClassroomRosterStudent[] = [
  { id: '1', name: '王小明', external_id: 'S001', email: 'ming@example.com', grade: 6, status: 'active' },
  { id: '2', name: '王小明', external_id: 'S002', email: 'second@example.com', grade: 5, status: 'active' },
  { id: '3', name: '林怡君', external_id: null, email: 'lin@example.com', grade: null, status: 'inactive' },
];

describe('filterClassroomStudents', () => {
  it('finds duplicate names while allowing a precise student ID match', () => {
    expect(filterClassroomStudents(students, new Set(), { search: '王小明', grade: 'all', membership: 'all' })).toHaveLength(2);
    expect(filterClassroomStudents(students, new Set(), { search: 's002', grade: 'all', membership: 'all' }).map(student => student.id)).toEqual(['2']);
  });

  it('searches email case-insensitively and trims the query', () => {
    expect(filterClassroomStudents(students, new Set(), { search: ' LIN@EXAMPLE.COM ', grade: 'all', membership: 'all' }).map(student => student.id)).toEqual(['3']);
  });

  it('combines grade and membership filters', () => {
    expect(filterClassroomStudents(students, new Set(['1']), { search: '', grade: '6', membership: 'enrolled' }).map(student => student.id)).toEqual(['1']);
    expect(filterClassroomStudents(students, new Set(['1']), { search: '', grade: '5', membership: 'available' }).map(student => student.id)).toEqual(['2']);
    expect(filterClassroomStudents(students, new Set(), { search: '', grade: 'unassigned', membership: 'all' }).map(student => student.id)).toEqual(['3']);
  });

  it('keeps a large roster searchable by an exact student ID', () => {
    const largeRoster = Array.from({ length: 1000 }, (_, index) => ({
      id: String(index),
      name: index % 2 === 0 ? '同名學生' : `學生 ${index}`,
      external_id: `S${String(index).padStart(5, '0')}`,
      email: `student-${index}@example.com`,
      grade: 5 + (index % 3),
      status: 'active',
    }));

    expect(filterClassroomStudents(largeRoster, new Set(), {
      search: 'S00999',
      grade: 'all',
      membership: 'available',
    }).map(student => student.id)).toEqual(['999']);
  });
});

describe('getRosterGrades', () => {
  it('returns unique numeric grades in ascending order', () => {
    expect(getRosterGrades(students)).toEqual([5, 6]);
  });
});
