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