import { createClient } from '@supabase/supabase-js';

// Create a single supabase client for the entire app
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create configuration object with optional redirect URL
const supabaseConfig = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseConfig); 