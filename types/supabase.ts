export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      students: {
        Row: {
          id: string
          created_at: string
          name: string
          email: string
          grade: number
          subjects: string[]
          status: 'active' | 'inactive'
          last_login: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          email: string
          grade: number
          subjects?: string[]
          status?: 'active' | 'inactive'
          last_login?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          email?: string
          grade?: number
          subjects?: string[]
          status?: 'active' | 'inactive'
          last_login?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          user_id: string
          full_name: string
          avatar_url: string | null
          role: 'admin' | 'teacher' | 'student'
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          full_name: string
          avatar_url?: string | null
          role?: 'admin' | 'teacher' | 'student'
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          full_name?: string
          avatar_url?: string | null
          role?: 'admin' | 'teacher' | 'student'
        }
      }
      events: {
        Row: {
          id: string
          created_at: string
          title: string
          description: string
          start_date: string
          end_date: string
          type: 'class' | 'meeting' | 'other'
          user_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          title: string
          description?: string
          start_date: string
          end_date: string
          type?: 'class' | 'meeting' | 'other'
          user_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          description?: string
          start_date?: string
          end_date?: string
          type?: 'class' | 'meeting' | 'other'
          user_id?: string | null
        }
      }
      assignments: {
        Row: {
          id: string
          created_at: string
          title: string
          description: string | null
          due_date: string
          status: 'pending' | 'completed' | 'late'
          student_id: string
          subject: string
          grade: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          title: string
          description?: string | null
          due_date: string
          status?: 'pending' | 'completed' | 'late'
          student_id: string
          subject: string
          grade?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          description?: string | null
          due_date?: string
          status?: 'pending' | 'completed' | 'late'
          student_id?: string
          subject?: string
          grade?: number | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 