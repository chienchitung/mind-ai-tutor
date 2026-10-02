import { describe, expect, it } from 'vitest';
import { mergeReportStudents } from './report-students';

describe('mergeReportStudents', () => {
  const roster = [{ id: 'uuid-1', name: '王小明' }];

  it('adds learners that only exist in unlinked records as guests', () => {
    expect(mergeReportStudents(roster, [
      { student_id: 'B11001', student_name: '陳同學' },
      { student_id: 'B11001', student_name: '陳同學' },
      { student_id: 'A10002', student_name: '林同學' },
    ])).toEqual([
      { id: 'uuid-1', name: '王小明' },
      { id: 'A10002', name: '林同學', guest: true },
      { id: 'B11001', name: '陳同學', guest: true },
    ]);
  });

  it('does not duplicate a roster student', () => {
    expect(mergeReportStudents(roster, [{ student_id: 'uuid-1', student_name: '王小明' }]))
      .toEqual([{ id: 'uuid-1', name: '王小明' }]);
  });

  it('skips rows without an id and falls back to the id for a missing name', () => {
    expect(mergeReportStudents([], [
      { student_id: null, student_name: '無編號' },
      { student_id: '  ', student_name: '空白' },
      { student_id: 'C1', student_name: null },
    ])).toEqual([{ id: 'C1', name: 'C1', guest: true }]);
  });
});
