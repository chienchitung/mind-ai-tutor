'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
// 移除直接導入
// import { supabase } from '@/lib/supabase';

// Types
export type EventPriority = 'low' | 'medium' | 'high';
export type EventStatus = 'to_do' | 'in_progress' | 'done';
export type EventType = 'course' | 'workshop' | 'training' | 'planning' | 'meeting' | 'other';
export type EventViewType = 'list' | 'kanban' | 'table' | 'timeline' | 'calendar';

export interface EventTag {
  id: string;
  name: string;
  color: string;
}

export interface EventAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  type: EventType;
  status: EventStatus;
  priority: EventPriority;
  position: number;
  startDate: string;
  endDate: string;
  tags: EventTag[];
  attachments: EventAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface EventColumn {
  id: string;
  name: string;
  events: Event[];
}

export interface EventView {
  id: string;
  name: string;
  icon: string;
  filters?: Record<string, any>;
  sort?: { field: string; direction: 'asc' | 'desc' };
}

// Mock data
const SAMPLE_TAGS: EventTag[] = [];

const SAMPLE_EVENTS: Event[] = [];

const DEFAULT_VIEWS: EventView[] = [
  {
    id: 'all',
    name: 'All Events',
    icon: 'calendar',
    sort: { field: 'endDate', direction: 'asc' }
  },
  {
    id: 'upcoming',
    name: 'Upcoming',
    icon: 'calendar-clock',
    filters: { status: 'to_do' },
    sort: { field: 'endDate', direction: 'asc' }
  },
  {
    id: 'in-progress',
    name: 'In Progress',
    icon: 'hourglass',
    filters: { status: 'in_progress' },
    sort: { field: 'updatedAt', direction: 'desc' }
  },
  {
    id: 'completed',
    name: 'Completed',
    icon: 'check-circle',
    filters: { status: 'done' },
    sort: { field: 'updatedAt', direction: 'desc' }
  }
];

// Helper functions
export function groupEventsByStatus(events: Event[]): EventColumn[] {
  return [
    {
      id: 'to_do',
      name: 'To Do',
      events: events.filter(event => event.status === 'to_do')
    },
    {
      id: 'in_progress',
      name: 'In Progress',
      events: events.filter(event => event.status === 'in_progress')
    },
    {
      id: 'done',
      name: 'Done',
      events: events.filter(event => event.status === 'done')
    }
  ];
}

export function filterEvents(events: Event[], filters: Record<string, any>): Event[] {
  return events.filter(event => {
    let matches = true;
    
    if (filters.status && filters.status !== 'all') {
      matches = matches && event.status === filters.status;
    }
    
    if (filters.priority && filters.priority !== 'all') {
      matches = matches && event.priority === filters.priority;
    }
    
    if (filters.type && filters.type !== 'all') {
      matches = matches && event.type === filters.type;
    }
    
    if (filters.tags && filters.tags.length > 0) {
      matches = matches && event.tags.some(tag => filters.tags.includes(tag.id));
    }
    
    if (filters.search && filters.search.trim() !== '') {
      const search = filters.search.toLowerCase().trim();
      matches = matches && (
        event.title.toLowerCase().includes(search) || 
        event.description.toLowerCase().includes(search)
      );
    }
    
    return matches;
  });
}

export function sortEvents(events: Event[], sort: { field: string; direction: 'asc' | 'desc' }): Event[] {
  return [...events].sort((a, b) => {
    let comparison = 0;
    
    switch (sort.field) {
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'startDate':
        comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        break;
      case 'endDate':
        comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
        break;
      case 'priority':
        const priorityOrder: Record<EventPriority, number> = { low: 0, medium: 1, high: 2 };
        comparison = priorityOrder[a.priority as EventPriority] - priorityOrder[b.priority as EventPriority];
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      default:
        comparison = 0;
    }
    
    return sort.direction === 'asc' ? comparison : -comparison;
  });
}

// Create Context
interface EventContextType {
  events: Event[];
  tags: EventTag[];
  views: EventView[];
  activeView: EventViewType;
  activeFilters: Record<string, any>;
  activeSort: { field: string; direction: 'asc' | 'desc' };
  isLoading: boolean;
  error: string | null;
  addEvent: (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'attachments'> & { tagIds: string[] }) => Promise<void>;
  updateEvent: (event: Event) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  setActiveView: (viewId: EventViewType) => void;
  setActiveFilters: (filters: Record<string, any>) => void;
  setActiveSort: (sort: { field: string; direction: 'asc' | 'desc' }) => void;
  filterText?: string;
  setFilterText?: (text: string) => void;
  selectedTags?: string[];
  setSelectedTags?: (tags: string[]) => void;
  filterPriority?: string;
  setFilterPriority?: (priority: string) => void;
  filterStatus?: string;
  setFilterStatus?: (status: string) => void;
  filterType?: string;
  setFilterType?: (type: string) => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const useEvents = () => {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventProvider');
  }
  return context;
};

// Helper to convert Supabase event format to our app format
const mapSupabaseEventToEvent = (event: any): Event => {
  return {
    id: event.id,
    title: event.title,
    description: event.description || '',
    type: ['course', 'workshop', 'training', 'planning', 'meeting', 'other'].includes(event.type) 
      ? event.type as EventType 
      : 'other' as EventType,
    status: ['to_do', 'in_progress', 'done'].includes(event.status) 
      ? event.status as EventStatus 
      : 'to_do' as EventStatus,
    priority: ['low', 'medium', 'high'].includes(event.priority) 
      ? event.priority as EventPriority 
      : 'medium' as EventPriority,
    position: typeof event.position === 'number' ? event.position : 0,
    startDate: event.start_date || new Date().toISOString(),
    endDate: event.end_date || new Date().toISOString(),
    tags: Array.isArray(event.tags) ? event.tags : [],
    attachments: [],
    createdAt: event.created_at || new Date().toISOString(),
    updatedAt: event.updated_at || new Date().toISOString()
  };
};

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [tags, setTags] = useState<EventTag[]>([]);
  const [views, setViews] = useState<EventView[]>(DEFAULT_VIEWS);
  const [activeView, setActiveView] = useState<EventViewType>('list');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [activeSort, setActiveSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({ 
    field: 'startDate', 
    direction: 'asc' 
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // 添加過濾功能的狀態
  const [filterText, setFilterText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  // Load initial data from Supabase
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 動態導入 supabase 函數以避免服務器端渲染問題
        const { supabase } = await import('@/lib/supabase');
        const supabaseClient = supabase();
        
        console.log('開始從 Supabase 加載事件數據...');
        
        // Fetch events
        const { data: eventsData, error: eventsError } = await supabaseClient
          .from('events')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (eventsError) {
          console.error('從 Supabase 加載事件失敗:', eventsError.message);
          setError(eventsError.message);
          setIsLoading(false);
          return;
        }
        
        console.log(`從 Supabase 加載了 ${eventsData?.length || 0} 個事件`);
        
        // 現在我們使用簡化的數據模型，不需要標籤表
        // 我們可以設置一個空的標籤數組
        setTags([]);
        
        // 檢查事件數據並轉換
        if (eventsData && eventsData.length > 0) {
          // 確保每個事件都有所有必要的字段
          const supabaseEvents = eventsData.map(event => {
            // 打印每個事件的關鍵字段以進行調試
            console.log(`事件 ID: ${event.id}, 標題: ${event.title}, 狀態: ${event.status || '未設置'}`);
            return mapSupabaseEventToEvent(event);
          });
          
          // 設置事件
          setEvents(supabaseEvents);
        } else {
          console.log('沒有找到事件，設置空數組');
          setEvents([]);
        }
        
        // 初始化默認視圖
        setViews(DEFAULT_VIEWS);
        
      } catch (err: any) {
        console.error('加載數據時出錯:', err);
        setError(err.message || '無法加載事件');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Add a new event
  const addEvent = async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'attachments'> & { tagIds: string[] }) => {
    try {
      // 動態導入 supabase 函數以避免服務器端渲染問題
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      const now = new Date().toISOString();
      const eventId = uuidv4();
      const selectedTags = eventData.tagIds
        ? tags.filter(tag => eventData.tagIds.includes(tag.id))
        : [];
        
      // 創建新事件對象，確保所有必要字段都有值
      const newEvent: Event = {
        id: eventId,
        title: eventData.title,
        description: eventData.description || '',
        type: ['course', 'workshop', 'training', 'planning', 'meeting', 'other'].includes(eventData.type)
          ? eventData.type
          : 'other' as EventType,
        status: ['to_do', 'in_progress', 'done'].includes(eventData.status as string)
          ? eventData.status as EventStatus
          : 'to_do' as EventStatus,
        priority: ['low', 'medium', 'high'].includes(eventData.priority as string)
          ? eventData.priority as EventPriority
          : 'medium' as EventPriority,
        position: typeof eventData.position === 'number' ? eventData.position : 0,
        startDate: eventData.startDate || now,
        endDate: eventData.endDate || now,
        tags: selectedTags,
        attachments: [],
        createdAt: now,
        updatedAt: now,
      };
      
      // 保存到 Supabase，確保使用正確的欄位名稱
      const { data, error } = await supabaseClient.from('events').insert({
        id: eventId,
        title: newEvent.title,
        description: newEvent.description,
        type: newEvent.type,
        status: newEvent.status,
        priority: newEvent.priority,
        position: newEvent.position,
        start_date: newEvent.startDate,
        end_date: newEvent.endDate,
        created_at: newEvent.createdAt,
        updated_at: newEvent.updatedAt,
      }).select();
      
      if (error) {
        console.error('Error adding event to Supabase:', error.message);
        throw new Error(error.message);
      }
      
      // 先更新本地狀態以立即顯示新事件
      setEvents(prev => [...prev, newEvent]);
      
      console.log('Event added successfully:', data);
      
      // 如果您需要標籤關聯，可以在這裡處理
      // 現在我們暫時不處理標籤關聯，簡化資料庫結構
      
      return data;
    } catch (err: any) {
      console.error('Error adding event:', err);
      throw err;
    }
  };

  // Update an existing event
  const updateEvent = async (event: Event) => {
    try {
      // 動態導入 supabase 函數以避免服務器端渲染問題
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      const updatedEvent = {
        ...event,
        updatedAt: new Date().toISOString(),
      };
      
      // Save to Supabase
      const { error } = await supabaseClient.from('events').update({
        title: updatedEvent.title,
        description: updatedEvent.description,
        type: updatedEvent.type,
        status: updatedEvent.status,
        priority: updatedEvent.priority,
        position: updatedEvent.position,
        start_date: updatedEvent.startDate,
        end_date: updatedEvent.endDate,
        updated_at: updatedEvent.updatedAt,
      }).eq('id', updatedEvent.id);
      
      if (error) throw new Error(error.message);
      
      setEvents(events.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    } catch (err: any) {
      console.error('Error updating event:', err);
      throw err;
    }
  };

  // Delete an event
  const deleteEvent = async (id: string) => {
    try {
      // First update the UI
      setEvents(events.filter(e => e.id !== id));
      
      // 動態導入 supabase 函數以避免服務器端渲染問題
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      // Validate if the ID exists in the database before trying to delete
      const { data: checkEvent } = await supabaseClient
        .from('events')
        .select('id')
        .eq('id', id)
        .single();
        
      // Only attempt deletion if the event exists in the database
      if (checkEvent) {
        // Delete from Supabase
        const { error } = await supabaseClient.from('events').delete().eq('id', id);
        
        if (error) {
          console.error('Error deleting from database:', error.message);
          // If deletion from database fails, restore the event in the UI
          const eventToRestore = events.find(e => e.id === id);
          if (eventToRestore) {
            setEvents(prev => [...prev, eventToRestore]);
          }
        }
      }
    } catch (err: any) {
      console.error('Error deleting event:', err);
      // Don't rethrow the error since we've already updated the UI
    }
  };

  const value = {
    events,
    tags,
    views,
    activeView,
    activeFilters,
    activeSort,
    isLoading,
    error,
    addEvent,
    updateEvent,
    deleteEvent,
    setActiveView,
    setActiveFilters,
    setActiveSort,
    filterText,
    setFilterText,
    selectedTags,
    setSelectedTags,
    filterPriority,
    setFilterPriority,
    filterStatus,
    setFilterStatus,
    filterType,
    setFilterType
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
};

// 定義 Supabase 客戶端類型
interface SupabaseClientWithAuth {
  auth: {
    getUser: () => Promise<{data: {user: any}}>;
  };
  from: (table: string) => {
    select: (columns?: string) => any;
    insert: (data: any) => any;
    update: (data: any) => any;
    delete: () => any;
    eq: (column: string, value: any) => any;
  };
} 