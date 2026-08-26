-- Run this in the Supabase SQL editor and paste the full result back.
-- Used to write correct owner-scoping migrations for the remaining
-- tables without guessing at columns/types that aren't tracked in this
-- repo's migration history.

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'lessons',
    'feedback',
    'assignments',
    'attendance',
    'progress',
    'digital_games',
    'learning_records',
    'question_counts'
  )
order by table_name, ordinal_position;

-- Also confirms which of these are real tables vs views (a view needs a
-- different RLS approach than a table).
select table_name, table_type
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'lessons',
    'feedback',
    'assignments',
    'attendance',
    'progress',
    'digital_games',
    'learning_records',
    'question_counts'
  );
