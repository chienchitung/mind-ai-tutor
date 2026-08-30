// Hand-reconstructed from a live `information_schema.columns` introspection
// of the production Supabase project (public schema), since this project has
// no local Supabase CLI/DB access to run `supabase gen types` directly.
// If you regenerate this file with the CLI, prefer the CLI's output over
// this file, but double check it still matches what the app actually reads.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Added by scripts/add_ai_quizzes.sql.
      ai_quizzes: {
        Row: { id: string; user_id: string; title: string; questions: Json; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; title: string; questions: Json; created_at?: string; updated_at?: string };
        Update: { title?: string; questions?: Json; updated_at?: string };
      };
      assignments: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          student_id: string;
          subject: string;
          title: string;
          description: string | null;
          due_date: string;
          status: string;
          score: number | null;
          feedback: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id?: string;
          student_id: string;
          subject: string;
          title: string;
          description?: string | null;
          due_date: string;
          status?: string;
          score?: number | null;
          feedback?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          student_id?: string;
          subject?: string;
          title?: string;
          description?: string | null;
          due_date?: string;
          status?: string;
          score?: number | null;
          feedback?: string | null;
        };
      };
      attendance: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          student_id: string;
          date: string;
          status: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id?: string;
          student_id: string;
          date: string;
          status: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          student_id?: string;
          date?: string;
          status?: string;
          notes?: string | null;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          learning_record_id: string;
          student_id: string;
          student_ref_id: string | null;
          lesson_id: string;
          game_id: string | null;
          message_content: string;
          is_user: boolean;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          learning_record_id: string;
          student_id: string;
          student_ref_id?: string | null;
          lesson_id: string;
          game_id?: string | null;
          message_content: string;
          is_user: boolean;
          timestamp?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          learning_record_id?: string;
          student_id?: string;
          student_ref_id?: string | null;
          lesson_id?: string;
          game_id?: string | null;
          message_content?: string;
          is_user?: boolean;
          timestamp?: string;
          created_at?: string;
        };
      };
      digital_games: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          url: string | null;
          thumbnail_url: string | null;
          created_at: string | null;
          updated_at: string | null;
          is_active: boolean | null;
          lesson_ids: string[] | null;
          settings: Json;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          description?: string | null;
          url?: string | null;
          thumbnail_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          is_active?: boolean | null;
          lesson_ids?: string[] | null;
          settings?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          url?: string | null;
          thumbnail_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          is_active?: boolean | null;
          lesson_ids?: string[] | null;
          settings?: Json;
        };
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          type: string;
          status: string;
          priority: string;
          position: number;
          start_date: string;
          end_date: string;
          tags: Json | null;
          created_at: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          type: string;
          status: string;
          priority: string;
          position?: number;
          start_date: string;
          end_date: string;
          tags?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          type?: string;
          status?: string;
          priority?: string;
          position?: number;
          start_date?: string;
          end_date?: string;
          tags?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
      };
      feedback: {
        Row: {
          id: string;
          student_name: string;
          student_initials: string;
          course: string;
          content: string;
          created_at: string;
          status: string;
          rating: number;
          user_id: string;
        };
        Insert: {
          id?: string;
          student_name: string;
          student_initials: string;
          course: string;
          content: string;
          created_at?: string;
          status: string;
          rating: number;
          user_id?: string;
        };
        Update: {
          id?: string;
          student_name?: string;
          student_initials?: string;
          course?: string;
          content?: string;
          created_at?: string;
          status?: string;
          rating?: number;
          user_id?: string;
        };
      };
      leaderboard: {
        Row: {
          id: string;
          student_id: string;
          student_name: string;
          student_ref_id: string | null;
          game_id: string | null;
          completion_time_seconds: number;
          completion_time_string: string;
          started_at: string;
          completed_at: string;
          stars_earned: number;
        };
        Insert: {
          id?: string;
          student_id: string;
          student_name: string;
          student_ref_id?: string | null;
          game_id?: string | null;
          completion_time_seconds: number;
          completion_time_string: string;
          started_at?: string;
          completed_at?: string;
          stars_earned?: number;
        };
        Update: {
          id?: string;
          student_id?: string;
          student_name?: string;
          student_ref_id?: string | null;
          game_id?: string | null;
          completion_time_seconds?: number;
          completion_time_string?: string;
          started_at?: string;
          completed_at?: string;
          stars_earned?: number;
        };
      };
      learning_records: {
        Row: {
          id: string;
          student_id: string;
          student_name: string;
          student_ref_id: string | null;
          lesson_id: string;
          game_id: string | null;
          started_at: string;
          completed_at: string;
          time_spent_seconds: number;
          answer_attempts: number;
        };
        Insert: {
          id?: string;
          student_id: string;
          student_name: string;
          student_ref_id?: string | null;
          lesson_id: string;
          game_id?: string | null;
          started_at: string;
          completed_at: string;
          time_spent_seconds: number;
          answer_attempts?: number;
        };
        Update: {
          id?: string;
          student_id?: string;
          student_name?: string;
          student_ref_id?: string | null;
          lesson_id?: string;
          game_id?: string | null;
          started_at?: string;
          completed_at?: string;
          time_spent_seconds?: number;
          answer_attempts?: number;
        };
      };
      lesson_order_mappings: {
        Row: {
          id: string;
          created_at: string | null;
          user_id: string;
          game_id: string;
          mapping: Json;
        };
        Insert: {
          id?: string;
          created_at?: string | null;
          user_id: string;
          game_id: string;
          mapping?: Json;
        };
        Update: {
          id?: string;
          created_at?: string | null;
          user_id?: string;
          game_id?: string;
          mapping?: Json;
        };
      };
      lessons: {
        Row: {
          id: string;
          title: string;
          description: string;
          duration: number;
          level: string;
          topics: Json;
          genially_link: string | null;
          teaching_content: string | null;
          practice_exercises: Json | null;
          metadata: Json | null;
          created_at: string | null;
          updated_at: string | null;
          markdown_content: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          duration?: number;
          level?: string;
          topics?: Json;
          genially_link?: string | null;
          teaching_content?: string | null;
          practice_exercises?: Json | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
          markdown_content?: string | null;
          user_id?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          duration?: number;
          level?: string;
          topics?: Json;
          genially_link?: string | null;
          teaching_content?: string | null;
          practice_exercises?: Json | null;
          metadata?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
          markdown_content?: string | null;
          user_id?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
          role: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: string;
        };
      };
      progress: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          student_id: string;
          subject: string;
          score: number;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id?: string;
          student_id: string;
          subject: string;
          score: number;
          notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          student_id?: string;
          subject?: string;
          score?: number;
          notes?: string | null;
        };
      };
      question_counts: {
        Row: {
          id: string;
          learning_record_id: string;
          student_id: string;
          student_ref_id: string | null;
          lesson_id: string;
          game_id: string | null;
          question_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          learning_record_id: string;
          student_id: string;
          student_ref_id?: string | null;
          lesson_id: string;
          game_id?: string | null;
          question_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          learning_record_id?: string;
          student_id?: string;
          student_ref_id?: string | null;
          lesson_id?: string;
          game_id?: string | null;
          question_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      students: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          name: string;
          email: string;
          grade: number | null;
          subjects: string[];
          status: string;
          last_login: string | null;
          login_code: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id?: string;
          name: string;
          email: string;
          grade?: number | null;
          subjects?: string[];
          status?: string;
          last_login?: string | null;
          login_code?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          name?: string;
          email?: string;
          grade?: number | null;
          subjects?: string[];
          status?: string;
          last_login?: string | null;
          login_code?: string | null;
        };
      };
    };
    Views: {
      leaderboard_best_scores: {
        Row: {
          student_id: string | null;
          student_name: string | null;
          completion_time_seconds: number | null;
          completion_time_string: string | null;
          started_at: string | null;
          completed_at: string | null;
          stars_earned: number | null;
          rank: number | null;
        };
      };
      leaderboard_view: {
        Row: {
          id: string | null;
          student_id: string | null;
          student_name: string | null;
          completion_time_seconds: number | null;
          completion_time_string: string | null;
          started_at: string | null;
          completed_at: string | null;
          stars_earned: number | null;
          rank: number | null;
        };
      };
      learning_records_view: {
        Row: {
          id: string | null;
          student_id: string | null;
          student_name: string | null;
          lesson_id: string | null;
          started_at_taipei: string | null;
          completed_at_taipei: string | null;
          time_spent_seconds: number | null;
          answer_attempts: number | null;
        };
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
