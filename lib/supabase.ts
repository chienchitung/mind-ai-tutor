import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// This check ensures we provide helpful messages when credentials are missing
if (!supabaseUrl || !supabaseAnonKey) {
  if (!supabaseUrl) console.error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) console.error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  // Still proceed with empty strings for development, but log warnings
  console.warn('Supabase client initialized with missing credentials');
}

// Create a single instance of the Supabase client with options
export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);

// Validate environment variables
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('Supabase credentials not found. Please check your .env.local file.');
} 