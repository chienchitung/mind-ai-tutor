import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface LearningRecord {
  id?: number
  student_id: string
  student_name: string
  lesson_id: string | number
  started_at: string
  completed_at: string
  time_spent_seconds: number
  answer_attempts: number
}

export interface LeaderboardEntry {
  id?: number
  student_id: string
  student_name: string
  completion_time_seconds: number
  completion_time_string: string
  completed_at: string
  started_at: string
  stars_earned: number
  rank?: number
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
  lesson_id: string
  message_content: string
  is_user: boolean
  timestamp: string
}

export interface QuestionCountRecord {
  id?: string
  learning_record_id: string
  student_id: string
  lesson_id: string
  question_count: number
}

export async function saveLearningRecord(record: Omit<LearningRecord, 'id'>) {
  try {
    // Validate input data
    if (!record.student_id || !record.student_name || !record.lesson_id || 
        !record.started_at || !record.completed_at) {
      throw new Error('Missing required fields for learning record');
    }

    // Generate a unique UUID for the ID field
    const recordWithId = {
      ...record,
      id: uuidv4()
    };

    const { data, error } = await supabase
      .from('learning_records')
      .insert([recordWithId])
      .select();

    if (error) {
      console.error('Error saving learning record:', error.message || JSON.stringify(error));
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in saveLearningRecord:', error instanceof Error ? error.message : JSON.stringify(error));
    throw error;
  }
}

export async function saveLeaderboardEntry(entry: Omit<LeaderboardEntry, 'id' | 'rank' | 'started_at'>) {
  try {
    // 驗證必要的數據
    if (!entry.student_id || !entry.student_name || !entry.completion_time_seconds || 
        !entry.completion_time_string || !entry.completed_at) {
      const errorMsg = 'Missing required fields for leaderboard entry';
      console.error(errorMsg, entry);
      throw new Error(errorMsg);
    }
    
    // 從 localStorage 獲取開始時間
    const startTime = localStorage.getItem('start_time');
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
        started_at: startTime,
        id: uuidv4()
      }])
      .select();

    if (error) {
      console.error('Error saving leaderboard entry:', error.message || JSON.stringify(error));
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in saveLeaderboardEntry:', error instanceof Error ? error.message : JSON.stringify(error));
    throw error;
  }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('leaderboard_view')
    .select('*')
    .order('completion_time_seconds', { ascending: true })

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

export async function getPlayerRank(student_id: string): Promise<number> {
  // 獲取所有用戶的最佳成績
  const { data: allScores, error: scoresError } = await supabase
    .from('leaderboard')
    .select('student_id, completion_time_seconds')
    .order('completion_time_seconds', { ascending: true });

  if (scoresError) {
    console.error('Error getting scores:', scoresError);
    throw scoresError;
  }

  if (!allScores || allScores.length === 0) return 0;

  // 獲取每個用戶的最佳成績
  const bestScores = Array.from(
    (allScores as ScoreRecord[]).reduce((map: Map<string, ScoreRecord>, score: ScoreRecord) => {
      if (!map.has(score.student_id) || 
          map.get(score.student_id)!.completion_time_seconds > score.completion_time_seconds) {
        map.set(score.student_id, score);
      }
      return map;
    }, new Map<string, ScoreRecord>())
  ).map(([, score]: [string, ScoreRecord]) => score);

  // 按完成時間排序
  bestScores.sort((a: ScoreRecord, b: ScoreRecord) => a.completion_time_seconds - b.completion_time_seconds);

  // 找到當前用戶的排名
  const rank = bestScores.findIndex((score: ScoreRecord) => score.student_id === student_id) + 1;
  
  return rank || bestScores.length + 1; // 如果沒有找到，返回最後一名
}

interface LeaderboardRecord {
  student_id: string;
  student_name: string;
  completion_time_seconds: number;
  completion_time_string: string;
}

export async function getLeaderboardStats(): Promise<LeaderboardStats> {
  // 獲取所有用戶的最佳成績
  const { data, error } = await supabase
    .from('leaderboard')
    .select('student_id, student_name, completion_time_seconds, completion_time_string')
    .order('completion_time_seconds', { ascending: true });

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

  // 添加排名數據（只顯示每個用戶的最佳成績）
  const rankings = bestScores.map((record, index) => {
    // 遮蔽學號中間四碼
    let maskedStudentId = record.student_id;
    if (maskedStudentId.length >= 8) {
      maskedStudentId = maskedStudentId.slice(0, 2) + '****' + maskedStudentId.slice(-2);
    } else if (maskedStudentId.length > 4) {
      // 例如6~7碼，遮蔽中間2~3碼
      const mid = Math.floor(maskedStudentId.length / 2) - 1;
      maskedStudentId = maskedStudentId.slice(0, mid) + '****' + maskedStudentId.slice(mid + 4);
    }
    
    // 遮蔽姓名
    let maskedName = record.student_name;
    if (maskedName.length === 3) {
      // 三個字的名字，遮蔽中間字
      maskedName = maskedName[0] + '○' + maskedName[2];
    } else if (maskedName.length === 2) {
      // 兩個字的名字，遮蔽第二個字
      maskedName = maskedName[0] + '○';
    }

    return {
      student_id: maskedStudentId,
      student_name: maskedName,
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
    // Validate input data
    if (!message.learning_record_id || !message.student_id || !message.lesson_id || !message.message_content) {
      throw new Error('Missing required fields for chat message');
    }

    // Generate a unique UUID for the ID field
    const messageWithId = {
      ...message,
      id: uuidv4()
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([messageWithId])
      .select();

    if (error) {
      console.error('Error saving chat message:', error.message || JSON.stringify(error));
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in saveChatMessage:', error instanceof Error ? error.message : JSON.stringify(error));
    // Don't throw to prevent breaking the chat flow
    return null;
  }
}

// Function to get or create a question count record
export async function getOrCreateQuestionCount(record: Omit<QuestionCountRecord, 'id' | 'question_count'>): Promise<{ id: string, question_count: number } | null> {
  try {
    // First try to get existing record
    const { data: existingData } = await supabase
      .from('question_counts')
      .select('id, question_count')
      .eq('learning_record_id', record.learning_record_id)
      .eq('student_id', record.student_id)
      .eq('lesson_id', record.lesson_id)
      .single();

    if (existingData) {
      return {
        id: existingData.id,
        question_count: existingData.question_count
      };
    }

    // If no record found, create a new one
    const { data: newData, error: insertError } = await supabase
      .from('question_counts')
      .insert([{
        ...record,
        question_count: 0,
        id: uuidv4()
      }])
      .select('id, question_count');

    if (insertError) {
      console.error('Error creating question count record:', insertError.message || JSON.stringify(insertError));
      throw insertError;
    }

    return newData?.[0] ? { id: newData[0].id, question_count: newData[0].question_count } : null;
  } catch (error) {
    console.error('Error in getOrCreateQuestionCount:', error instanceof Error ? error.message : JSON.stringify(error));
    return null;
  }
}

// Function to increment the question count
export async function incrementQuestionCount(id: string): Promise<number | null> {
  try {
    // Get current count
    const { data: currentData, error: getError } = await supabase
      .from('question_counts')
      .select('question_count')
      .eq('id', id)
      .single();

    if (getError) {
      console.error('Error getting current question count:', getError.message || JSON.stringify(getError));
      throw getError;
    }

    const currentCount = currentData?.question_count || 0;
    const newCount = currentCount + 1;

    // Update the count
    const { data: updatedData, error: updateError } = await supabase
      .from('question_counts')
      .update({ question_count: newCount, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('question_count');

    if (updateError) {
      console.error('Error updating question count:', updateError.message || JSON.stringify(updateError));
      throw updateError;
    }

    return updatedData?.[0]?.question_count || null;
  } catch (error) {
    console.error('Error in incrementQuestionCount:', error instanceof Error ? error.message : JSON.stringify(error));
    return null;
  }
}

// Function to get learning record ID for a student and lesson
export async function getLearningRecordId(studentId: string, lessonId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('learning_records')
      .select('id')
      .eq('student_id', studentId)
      .eq('lesson_id', lessonId)
      .order('completed_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error getting learning record ID:', error.message || JSON.stringify(error));
      throw error;
    }

    return data && data.length > 0 ? data[0].id : null;
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