/**
 * CSV Export Utilities
 */

interface LearningRecord {
  id: number;
  student_id: string;
  student_name: string;
  lesson_id: number;
  started_at?: string; 
  completed_at?: string | null;
  time_spent_seconds?: number;
  category?: string | null;
  // Add field names from the database view
  started_at_taipei?: string;
  completed_at_taipei?: string;
  // Other alternative field names
  start_time?: string;
  end_time?: string;
  duration?: number;
}

/**
 * Export learning records to CSV and trigger download
 */
export function exportLearningRecordsToCsv(
  records: LearningRecord[], 
  studentName: string
): void {
  // Debug logs
  console.log('Exporting records:', records.length);
  console.log('Student name:', studentName);
  
  if (!records || records.length === 0) return;
  
  try {
    // CSV header
    let csv = 'Lesson ID,Student Name,Started At,Completed At,Time Spent (seconds),Category,Status\n';
    
    // Add each record as a row
    for (const record of records) {
      // Basic fields
      const id = record.lesson_id || '';
      const name = (record.student_name || '').replace(/,/g, ' '); // Remove commas
      const category = (record.category || 'Uncategorized').replace(/,/g, ' '); 
      
      // Time fields
      let startedAt = '';
      if (record.started_at_taipei) startedAt = record.started_at_taipei;
      else if (record.started_at) startedAt = record.started_at;
      else if (record.start_time) startedAt = record.start_time;
      
      let completedAt = '';
      if (record.completed_at_taipei) completedAt = record.completed_at_taipei;
      else if (record.completed_at) completedAt = record.completed_at;
      else if (record.end_time) completedAt = record.end_time;
      
      const timeSpent = record.time_spent_seconds || record.duration || 0;
      
      // Status
      const hasCompletionData = completedAt !== null && completedAt !== undefined && completedAt !== '';
      const status = hasCompletionData ? 'Completed' : 'In Progress';
      
      // Add row
      csv += `${id},${name},${startedAt},${completedAt},${timeSpent},${category},${status}\n`;
    }
    
    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `learning-data-${studentName}-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting data:', error);
  }
} 