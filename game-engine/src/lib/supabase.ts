import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { gameStorageKey } from './game-storage'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface LearningRecord {
  id?: number
  student_id: string
  student_name: string
  student_ref_id?: string | null
  lesson_id: string | number
  started_at: string
  completed_at: string
  time_spent_seconds: number
  answer_attempts: number
  game_id?: string | null
}

export interface LeaderboardEntry {
  id?: number
  student_id: string
  student_name: string
  student_ref_id?: string | null
  completion_time_seconds: number
  completion_time_string: string
  completed_at: string
  started_at: string
  stars_earned: number
  rank?: number
  game_id?: string | null
}

export interface VerifiedStudent {
  student_id: string
  student_name: string
  grade: number | null
}

// Verifies a teacher-issued login code against public.students via a
// SECURITY DEFINER RPC, so the anon key can never read the roster table
// directly (RLS on students only allows the owning teacher). Returns null
// for an invalid/unknown code.
export async function verifyStudentLoginCode(code: string): Promise<VerifiedStudent | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase.rpc('verify_student_login_code', {
    p_code: trimmed,
  });

  if (error) {
    console.error('Error verifying student login code:', error.message || JSON.stringify(error));
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  // Defensive guard for malformed/legacy RPC responses. A successful login
  // must always contain both the roster UUID and a non-empty display name.
  if (
    !row ||
    typeof row.student_id !== 'string' ||
    !row.student_id ||
    typeof row.student_name !== 'string' ||
    !row.student_name.trim()
  ) return null;

  return {
    student_id: row.student_id,
    student_name: row.student_name,
    grade: row.grade ?? null,
  };
}

// Reads the real student row id set by a successful login-code verification.
// Absent for anonymous play (the default) - every insert below treats it as
// optional, so this never affects the anonymous flow.
function getStoredStudentRefId(gameId?: string | null): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(gameStorageKey(gameId ?? undefined, 'student_ref_id'));
}

// Cloud learning data is only written after a teacher-issued code has linked
// this browser to a roster row. Guest play remains entirely device-local.
export function hasLinkedStudent(gameId?: string | null): boolean {
  return Boolean(getStoredStudentRefId(gameId));
}

export interface LeaderboardStats {
  total_participants: number;
  fastest_time: string;
  average_time: string;
  rankings: { student_id: string, student_name: string, completion_time_string: string, rank: number }[];
}

export interface LessonOrderMapping {
  id: string;
  created_at: string;
  user_id: string;
  game_id: string;
  mapping: {
    number: number;
    lesson_id: string;
    genially_link?: string;
  }[];
}

export interface ChatMessageRecord {
  id?: string;
  learning_record_id: string
  student_id: string
  student_ref_id?: string | null
  lesson_id: string
  message_content: string
  is_user: boolean
  timestamp: string
  game_id?: string | null
}

export interface QuestionCountRecord {
  id?: string
  learning_record_id: string
  student_id: string
  student_ref_id?: string | null
  lesson_id: string
  question_count: number
  game_id?: string | null
}

export async function saveLearningRecord(record: Omit<LearningRecord, 'id'>) {
  try {
    if (!hasLinkedStudent(record.game_id)) return [];
    // Validate input data
    if (!record.student_id || !record.student_name || !record.lesson_id || 
        !record.started_at || !record.completed_at) {
      throw new Error('Missing required fields for learning record');
    }

    // Generate a unique UUID for the ID field
    const recordWithId = {
      ...record,
      student_ref_id: record.student_ref_id ?? getStoredStudentRefId(record.game_id),
      id: uuidv4()
    };

    const { data, error } = await supabase
      .from('learning_records')
      .insert([recordWithId]);

    if (error) {
      console.error('Error saving learning record:', error.message || JSON.stringify(error));
      throw error;
    }

    return [recordWithId];
  } catch (error) {
    console.error('Error in saveLearningRecord:', error instanceof Error ? error.message : JSON.stringify(error));
    throw error;
  }
}

export async function saveLeaderboardEntry(entry: Omit<LeaderboardEntry, 'id' | 'rank' | 'started_at'>) {
  try {
    if (!hasLinkedStudent(entry.game_id)) return [];
    // 驗證必要的數據
    if (!entry.student_id || !entry.student_name || !entry.completion_time_seconds || 
        !entry.completion_time_string || !entry.completed_at) {
      const errorMsg = 'Missing required fields for leaderboard entry';
      console.error(errorMsg, entry);
      throw new Error(errorMsg);
    }
    
    // 從 localStorage 獲取開始時間
    const startTime = localStorage.getItem(gameStorageKey(entry.game_id ?? undefined, 'start_time'));
    if (!startTime) {
      console.error('Missing start time in localStorage');
      throw new Error('Missing start time');
    }

    // 打印將要儲存的數據用於調試
    console.log('Saving leaderboard entry:', {
      ...entry,
      started_at: startTime
    });

    // 總是插入新記錄，並加上UUID
    const { data, error } = await supabase
      .from('leaderboard')
      .insert([{
        ...entry,
        student_ref_id: entry.student_ref_id ?? getStoredStudentRefId(entry.game_id),
        started_at: startTime,
        id: uuidv4()
      }]);

    if (error) {
      console.error('Error saving leaderboard entry:', error.message || JSON.stringify(error));
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in saveLeaderboardEntry:', error instanceof Error ? error.message : JSON.stringify(error));
    throw error;
  }
}

export interface GuestPlayStat {
  game_id: string
  lesson_id: string | number
  started_at: string
  completed_at: string
  time_spent_seconds: number
  answer_attempts: number
  is_final_lesson?: boolean
}

// Anonymous aggregate stats for guest (no login-code) play, visible only to
// the game's own creator - see scripts/add_guest_play_stats.sql for why this
// is its own table (no name, no student id at all) rather than relaxing
// learning_records'/leaderboard's roster-linked guarantee for guests.
export async function saveGuestPlayStats(stat: GuestPlayStat) {
  try {
    if (!stat.game_id || hasLinkedStudent(stat.game_id)) return null;

    const { error } = await supabase.from('guest_play_stats').insert([{
      game_id: stat.game_id,
      lesson_id: String(stat.lesson_id),
      started_at: stat.started_at,
      completed_at: stat.completed_at,
      time_spent_seconds: stat.time_spent_seconds,
      answer_attempts: stat.answer_attempts,
      is_final_lesson: stat.is_final_lesson ?? false,
    }]);

    if (error) {
      console.error('Error saving guest play stats:', error.message || JSON.stringify(error));
      return null;
    }
    return true;
  } catch (error) {
    console.error('Error in saveGuestPlayStats:', error instanceof Error ? error.message : JSON.stringify(error));
    return null;
  }
}

export async function getLeaderboard(gameId?: string): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_public_game_leaderboard', {
    p_game_id: gameId ?? null,
  });

  if (error) {
    console.error('Error fetching leaderboard:', error)
    throw error
  }

  return data || []
}

interface ScoreRecord {
  student_id: string;
  completion_time_seconds: number;
}

export async function getPlayerRank(student_id: string, gameId?: string): Promise<number> {
  if (!hasLinkedStudent(gameId)) return 0;
  const { data, error } = await supabase.rpc('get_game_player_rank', {
    p_student_ref_id: student_id,
    p_game_id: gameId ?? null,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

interface LeaderboardRecord {
  student_id: string;
  student_name: string;
  completion_time_seconds: number;
  completion_time_string: string;
}

export async function getLeaderboardStats(gameId?: string): Promise<LeaderboardStats> {
  const { data, error } = await supabase.rpc('get_public_game_leaderboard', {
    p_game_id: gameId ?? null,
  });

  if (error) {
    console.error('Error fetching leaderboard stats:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return {
      total_participants: 0,
      fastest_time: '--:--',
      average_time: '--:--',
      rankings: []
    };
  }

  // 計算不重複用戶數
  const uniqueUsers = new Set((data as LeaderboardRecord[]).map((record: LeaderboardRecord) => record.student_id));
  const totalParticipants = uniqueUsers.size;

  // 獲取每個用戶的最佳成績
  const bestScores = Array.from(uniqueUsers).map(userId => {
    return (data as LeaderboardRecord[])
      .filter((record: LeaderboardRecord) => record.student_id === userId)
      .reduce((best: LeaderboardRecord, current: LeaderboardRecord) => 
        best.completion_time_seconds < current.completion_time_seconds ? best : current
      );
  }).sort((a: LeaderboardRecord, b: LeaderboardRecord) => a.completion_time_seconds - b.completion_time_seconds);

  const fastestTime = bestScores[0].completion_time_string;
  const averageSeconds = Math.floor(
    bestScores.reduce((sum, record) => sum + record.completion_time_seconds, 0) / totalParticipants
  );
  const averageMinutes = Math.floor(averageSeconds / 60);
  const averageRemainingSeconds = averageSeconds % 60;
  const averageTime = `${averageMinutes}分${averageRemainingSeconds}秒`;

  // The RPC already returns one best score per learner with identifiers
  // masked inside Postgres, before anything reaches an anonymous client.
  const rankings = bestScores.map((record, index) => {
    return {
      student_id: record.student_id,
      student_name: record.student_name,
      completion_time_string: record.completion_time_string,
      rank: index + 1
    };
  });

  return {
    total_participants: totalParticipants,
    fastest_time: fastestTime,
    average_time: averageTime,
    rankings
  };
}

export async function getLessonOrderMappings(): Promise<LessonOrderMapping[]> {
  try {
    const { data, error } = await supabase
      .from('lesson_order_mappings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching lesson order mappings:', error);
      throw error;
    }

    // Ensure each mapping has the correct structure
    if (data && data.length > 0) {
      // Make sure mapping is parsed as an array
      const parsedData = data.map(item => {
        let mapping = item.mapping;
        
        // If mapping is a string, parse it
        if (typeof mapping === 'string') {
          try {
            mapping = JSON.parse(mapping);
          } catch (e) {
            console.error('Error parsing mapping JSON:', e);
            mapping = [];
          }
        }
        
        // Ensure number is a number type
        const validMapping = Array.isArray(mapping) 
          ? mapping.map(m => ({
              number: typeof m.number === 'string' ? parseInt(m.number, 10) : m.number,
              lesson_id: m.lesson_id,
              genially_link: m.genially_link
            }))
          : [];
        
        return {
          ...item,
          mapping: validMapping
        };
      });
      
      return parsedData;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getLessonOrderMappings:', error);
    return [];
  }
}

// Function to save chat messages to Supabase
export async function saveChatMessage(message: Omit<ChatMessageRecord, 'id'>) {
  try {
    if (!hasLinkedStudent(message.game_id)) return null;
    // Validate input data
    if (!message.learning_record_id || !message.student_id || !message.lesson_id || !message.message_content) {
      throw new Error('Missing required fields for chat message');
    }

    // Generate a unique UUID for the ID field
    const messageWithId = {
      ...message,
      student_ref_id: message.student_ref_id ?? getStoredStudentRefId(message.game_id),
      id: uuidv4()
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([messageWithId]);

    if (error) {
      console.error('Error saving chat message:', error.message || JSON.stringify(error));
      throw error;
    }

    return data || [messageWithId];
  } catch (error) {
    console.error('Error in saveChatMessage:', error instanceof Error ? error.message : JSON.stringify(error));
    // Don't throw to prevent breaking the chat flow
    return null;
  }
}

// Function to get or create a question count record
export async function getOrCreateQuestionCount(record: Omit<QuestionCountRecord, 'id' | 'question_count'>): Promise<{ id: string, question_count: number } | null> {
  if (!hasLinkedStudent(record.game_id)) return null;
  return { id: record.learning_record_id, question_count: 0 };
}

// Function to increment the question count
export async function incrementQuestionCount(id: string, gameId?: string | null): Promise<number | null> {
  try {
    const studentRefId = getStoredStudentRefId(gameId);
    if (!studentRefId) return null;
    const { data, error } = await supabase.rpc('increment_game_question_count', {
      p_learning_record_id: id,
      p_student_ref_id: studentRefId,
      p_increment: 1,
    });
    if (error) throw error;
    return typeof data === 'number' ? data : null;
  } catch (error) {
    console.error('Error in incrementQuestionCount:', error instanceof Error ? error.message : JSON.stringify(error));
    return null;
  }
}

// Function to get learning record ID for a student and lesson
export async function getLearningRecordId(studentId: string, lessonId: string, gameId?: string): Promise<string | null> {
  try {
    if (!hasLinkedStudent(gameId)) return null;
    const { data, error } = await supabase.rpc('get_latest_learning_record_id', {
      p_student_ref_id: studentId,
      p_lesson_id: lessonId,
      p_game_id: gameId ?? null,
    });

    if (error) {
      console.error('Error getting learning record ID:', error.message || JSON.stringify(error));
      throw error;
    }

    return typeof data === 'string' ? data : null;
  } catch (error) {
    console.error('Error in getLearningRecordId:', error instanceof Error ? error.message : JSON.stringify(error));
    return null;
  }
}

// Function to get Genially link for a specific lesson
export async function getGeniallyLink(lessonId: string): Promise<string | null> {
  try {
    // 直接從 lessons 資料表中獲取指定 lesson ID 的 genially_link
    const { data, error } = await supabase
      .from('lessons')
      .select('genially_link')
      .eq('id', lessonId)
      .single();
    
    if (error) {
      console.error('Error fetching Genially link:', error.message || JSON.stringify(error));
      return null;
    }
    
    // 返回找到的連結或 null
    return data?.genially_link || null;
  } catch (error) {
    console.error('Error getting Genially link:', error instanceof Error ? error.message : JSON.stringify(error));
    return null;
  }
}

// Function to get all Genially links for all lessons
export async function getAllGeniallyLinks(): Promise<Map<string, string>> {
  try {
    const mappingsData = await getLessonOrderMappings();
    const geniallyLinks = new Map<string, string>();
    
    if (mappingsData.length > 0 && mappingsData[0].mapping && mappingsData[0].mapping.length > 0) {
      mappingsData[0].mapping.forEach(m => {
        if (m.lesson_id && m.genially_link) {
          geniallyLinks.set(m.lesson_id, m.genially_link);
        }
      });
    }
    
    return geniallyLinks;
  } catch (error) {
    console.error('Error getting all Genially links:', error instanceof Error ? error.message : JSON.stringify(error));
    return new Map<string, string>();
  }
}

// Function to get Markdown content for a specific lesson
export async function getLessonMarkdownContent(lessonId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('lessons')
      .select('markdown_content')
      .eq('id', lessonId)
      .single();
    
    if (error) {
      console.error('Error fetching lesson markdown content:', error.message || JSON.stringify(error));
      return null;
    }
    
    return data?.markdown_content || null;
  } catch (error) {
    console.error('Error getting lesson markdown content:', error instanceof Error ? error.message : JSON.stringify(error));
    return null;
  }
}
