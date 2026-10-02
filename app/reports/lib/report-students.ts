export interface ReportStudent {
  id: string;
  name: string;
  // Learned before roster login codes existed: their learning_records carry
  // whatever id the learner typed in the game (no student_ref_id), so they
  // have no roster row, class membership or saved AI reports.
  guest?: boolean;
}

interface UnlinkedRecordRow {
  student_id: string | null;
  student_name: string | null;
}

// Roster students first, then every learner who only exists in older
// unlinked learning_records - without them those records can't be selected
// and silently disappear from reports.
export function mergeReportStudents(
  roster: { id: string; name: string }[],
  unlinkedRecords: UnlinkedRecordRow[],
): ReportStudent[] {
  const rosterIds = new Set(roster.map(student => student.id));
  const guests = new Map<string, ReportStudent>();

  for (const row of unlinkedRecords) {
    const id = row.student_id?.trim();
    if (!id || rosterIds.has(id) || guests.has(id)) continue;
    guests.set(id, { id, name: row.student_name?.trim() || id, guest: true });
  }

  const byName = (a: ReportStudent, b: ReportStudent) => a.name.localeCompare(b.name, 'zh-Hant');
  return [
    ...roster.map(student => ({ id: student.id, name: student.name })),
    ...Array.from(guests.values()).sort(byName),
  ];
}
