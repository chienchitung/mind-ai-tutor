-- Create event_tags table
CREATE TABLE event_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('course', 'workshop', 'training', 'planning', 'meeting', 'other')),
  status TEXT NOT NULL CHECK (status IN ('to_do', 'in_progress', 'done')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events_tags junction table
CREATE TABLE events_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES event_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, tag_id)
);

-- Add index for better query performance
CREATE INDEX events_status_idx ON events(status);
CREATE INDEX events_type_idx ON events(type);
CREATE INDEX events_start_date_idx ON events(start_date);
CREATE INDEX events_end_date_idx ON events(end_date);

-- Insert sample tags
INSERT INTO event_tags (name, color) VALUES
  ('Course', '#3b82f6'),
  ('Workshop', '#8b5cf6'),
  ('Meeting', '#10b981'),
  ('In Progress', '#f59e0b');

-- Insert sample events
INSERT INTO events (title, description, type, status, priority, start_date, end_date) VALUES
  ('New Course Launch', 'Launch of the new course for Spring 2024', 'course', 'done', 'high', '2024-04-15', '2024-04-20'),
  ('Student Onboarding', 'New student onboarding session', 'meeting', 'in_progress', 'medium', '2024-04-10', '2024-04-15'),
  ('Excel Workshop', 'Advanced Excel techniques workshop', 'workshop', 'to_do', 'medium', '2024-04-20', '2024-04-22'),
  ('Progress Review', 'Quarterly progress review meeting', 'meeting', 'to_do', 'high', '2024-04-23', '2024-04-25');

-- Link events with tags (junction table)
INSERT INTO events_tags (event_id, tag_id) VALUES
  ((SELECT id FROM events WHERE title = 'New Course Launch'), (SELECT id FROM event_tags WHERE name = 'Course')),
  ((SELECT id FROM events WHERE title = 'Student Onboarding'), (SELECT id FROM event_tags WHERE name = 'Meeting')),
  ((SELECT id FROM events WHERE title = 'Excel Workshop'), (SELECT id FROM event_tags WHERE name = 'Workshop')),
  ((SELECT id FROM events WHERE title = 'Progress Review'), (SELECT id FROM event_tags WHERE name = 'Meeting'));

-- Create view to get events with their tags in a more convenient structure
CREATE OR REPLACE VIEW events_with_tags AS
SELECT 
  e.id,
  e.title,
  e.description,
  e.type,
  e.status,
  e.priority,
  e.start_date,
  e.end_date,
  e.created_at,
  e.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id', t.id,
        'name', t.name,
        'color', t.color
      )
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'
  ) as tags
FROM 
  events e
LEFT JOIN 
  events_tags et ON e.id = et.event_id
LEFT JOIN 
  event_tags t ON et.tag_id = t.id
GROUP BY 
  e.id; 