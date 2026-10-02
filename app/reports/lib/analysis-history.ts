export interface SavedAnalysisReport {
  id: string;
  analysis: string;
  language: 'en' | 'zh-TW';
  scope_label: string | null;
  record_count: number;
  created_at: string;
}

export type HistoryLoad =
  | { status: 'ok'; reports: SavedAnalysisReport[] }
  // The learning_analysis_reports migration hasn't been applied to this
  // database yet - hide history rather than surfacing an error, since
  // generating analysis itself still works.
  | { status: 'unavailable' }
  | { status: 'error' };

const HISTORY_LIMIT = 10;

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01'
    || /could not find the table|does not exist/i.test(error.message ?? '');
}

async function client() {
  const { supabase } = await import('@/lib/supabase');
  // The table is newer than the generated Database types.
  return supabase() as any;
}

export async function loadAnalysisHistory(studentId: string): Promise<HistoryLoad> {
  try {
    const { data, error } = await (await client())
      .from('learning_analysis_reports')
      .select('id, analysis, language, scope_label, record_count, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    if (isMissingTable(error)) return { status: 'unavailable' };
    if (error) return { status: 'error' };
    return { status: 'ok', reports: data ?? [] };
  } catch {
    return { status: 'error' };
  }
}

export async function saveAnalysisReport(report: {
  studentId: string;
  analysis: string;
  language: 'en' | 'zh-TW';
  scopeLabel: string;
  recordCount: number;
}): Promise<SavedAnalysisReport | null> {
  try {
    const { data, error } = await (await client())
      .from('learning_analysis_reports')
      .insert({
        student_id: report.studentId,
        analysis: report.analysis,
        language: report.language,
        scope_label: report.scopeLabel.slice(0, 200),
        record_count: report.recordCount,
      })
      .select('id, analysis, language, scope_label, record_count, created_at')
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}
