-- 刪除舊表（如果存在）
DROP TABLE IF EXISTS events_tags;
DROP TABLE IF EXISTS event_tags;
DROP VIEW IF EXISTS events_with_tags;

-- 創建簡化的 events 表
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('course', 'workshop', 'training', 'planning', 'meeting', 'other')),
  status TEXT NOT NULL CHECK (status IN ('to_do', 'in_progress', 'done')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  position INTEGER DEFAULT 0 NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  tags JSONB DEFAULT '[]',  -- 使用 JSONB 格式儲存標籤信息
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加索引以提高查詢效能
CREATE INDEX events_status_idx ON events(status);
CREATE INDEX events_type_idx ON events(type);
CREATE INDEX events_start_date_idx ON events(start_date);
CREATE INDEX events_end_date_idx ON events(end_date);

-- 插入範例事件
INSERT INTO events (title, description, type, status, priority, start_date, end_date, tags) VALUES
  ('新課程上線', '2024年春季新課程上線', 'course', 'done', 'high', '2024-04-15', '2024-04-20', 
   '[{"id": "tag1", "name": "課程", "color": "#3b82f6"}]'),
  ('學生入門介紹', '新學生入門培訓課程', 'meeting', 'in_progress', 'medium', '2024-04-10', '2024-04-15',
   '[{"id": "tag2", "name": "會議", "color": "#10b981"}]'),
  ('Excel 工作坊', '進階 Excel 技能工作坊', 'workshop', 'to_do', 'medium', '2024-04-20', '2024-04-22',
   '[{"id": "tag3", "name": "工作坊", "color": "#8b5cf6"}]'),
  ('進度回顧', '季度進度回顧會議', 'meeting', 'to_do', 'high', '2024-04-23', '2024-04-25',
   '[{"id": "tag2", "name": "會議", "color": "#10b981"}]'); 