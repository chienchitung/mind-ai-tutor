-- Create the lesson_order_mappings table
CREATE TABLE IF NOT EXISTS public.lesson_order_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id UUID NOT NULL,
  mapping JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS lesson_order_mappings_user_id_idx ON public.lesson_order_mappings (user_id);
CREATE INDEX IF NOT EXISTS lesson_order_mappings_game_id_idx ON public.lesson_order_mappings (game_id);
CREATE UNIQUE INDEX IF NOT EXISTS lesson_order_mappings_user_game_idx ON public.lesson_order_mappings (user_id, game_id);

-- Set up Row Level Security (RLS)
ALTER TABLE public.lesson_order_mappings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only see their own mappings
CREATE POLICY lesson_order_mappings_select_policy 
  ON public.lesson_order_mappings 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy to allow users to only insert their own mappings
CREATE POLICY lesson_order_mappings_insert_policy 
  ON public.lesson_order_mappings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to only update their own mappings
CREATE POLICY lesson_order_mappings_update_policy 
  ON public.lesson_order_mappings 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policy to allow users to only delete their own mappings
CREATE POLICY lesson_order_mappings_delete_policy 
  ON public.lesson_order_mappings 
  FOR DELETE 
  USING (auth.uid() = user_id);