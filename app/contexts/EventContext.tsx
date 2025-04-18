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
const SAMPLE_TAGS: EventTag[] = [
  { id: '1', name: 'Important', color: '#ef4444' },
  { id: '2', name: 'Course', color: '#3b82f6' },
  { id: '3', name: 'Workshop', color: '#8b5cf6' },
  { id: '4', name: 'Meeting', color: '#10b981' },
  { id: '5', name: 'In Progress', color: '#f59e0b' },
];

const SAMPLE_EVENTS: Event[] = [
  {
    id: '1',
    title: 'New Course Launch',
    description: 'Launch of the new course for Spring 2024',
    type: 'course',
    status: 'to_do',
    priority: 'high',
    position: 0,
    startDate: '2024-04-15',
    endDate: '2024-04-20',
    tags: [SAMPLE_TAGS[1]],
    attachments: [],
    createdAt: '2024-04-15T08:00:00Z',
    updatedAt: '2024-04-15T08:00:00Z'
  },
  {
    id: '2',
    title: 'Student Onboarding',
    description: 'New student onboarding session',
    type: 'meeting',
    status: 'to_do',
    priority: 'medium',
    position: 0,
    startDate: '2024-04-10',
    endDate: '2024-04-15',
    tags: [SAMPLE_TAGS[3]],
    attachments: [],
    createdAt: '2024-04-10T09:00:00Z',
    updatedAt: '2024-04-10T09:00:00Z'
  },
  {
    id: '3',
    title: 'Excel Workshop',
    description: 'Advanced Excel techniques workshop',
    type: 'workshop',
    status: 'to_do',
    priority: 'medium',
    position: 0,
    startDate: '2024-04-20',
    endDate: '2024-04-22',
    tags: [SAMPLE_TAGS[2]],
    attachments: [],
    createdAt: '2024-04-12T11:00:00Z',
    updatedAt: '2024-04-12T11:00:00Z'
  },
  {
    id: '4',
    title: 'Progress Review',
    description: 'Quarterly progress review meeting',
    type: 'meeting',
    status: 'to_do',
    priority: 'high',
    position: 0,
    startDate: '2024-04-23',
    endDate: '2024-04-25',
    tags: [SAMPLE_TAGS[3], SAMPLE_TAGS[0]],
    attachments: [],
    createdAt: '2024-04-15T13:00:00Z',
    updatedAt: '2024-04-15T13:00:00Z'
  }
];

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
    type: event.type as EventType,
    status: event.status as EventStatus,
    priority: event.priority as EventPriority,
    position: event.position || 0,
    startDate: event.start_date,
    endDate: event.end_date,
    tags: Array.isArray(event.tags) ? event.tags : [],
    attachments: [],
    createdAt: event.created_at,
    updatedAt: event.updated_at
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
        
        const { data, error } = await supabaseClient.from('events').select('*');
        
        if (error) {
          setError(error.message);
          setIsLoading(false);
          return;
        }
        
        // Transform Supabase data to Event objects
        const supabaseEvents = data?.map(mapSupabaseEventToEvent) || [];
        
        // For now, combine with sample events for demo purposes
        const combinedEvents = [...SAMPLE_EVENTS, ...supabaseEvents];
        setEvents(combinedEvents);
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message || 'Failed to load events');
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
      const selectedTags = eventData.tagIds
        ? tags.filter(tag => eventData.tagIds.includes(tag.id))
        : [];
        
      const newEvent: Event = {
        id: uuidv4(),
        ...eventData,
        tags: selectedTags,
        attachments: [],
        createdAt: now,
        updatedAt: now,
      };
      
      // Save to Supabase
      const { error } = await supabaseClient.from('events').insert({
        id: newEvent.id,
        title: newEvent.title,
        description: newEvent.description,
        type: newEvent.type,
        status: newEvent.status,
        priority: newEvent.priority,
        position: newEvent.position,
        start_date: newEvent.startDate,
        end_date: newEvent.endDate,
        tags: JSON.stringify(newEvent.tags),
        created_at: newEvent.createdAt,
        updated_at: newEvent.updatedAt,
      });
      
      if (error) throw new Error(error.message);
      
      setEvents([...events, newEvent]);
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
        tags: JSON.stringify(updatedEvent.tags),
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
      // 動態導入 supabase 函數以避免服務器端渲染問題
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      
      // Delete from Supabase
      const { error } = await supabaseClient.from('events').delete().eq('id', id);
      
      if (error) throw new Error(error.message);
      
      setEvents(events.filter(e => e.id !== id));
    } catch (err: any) {
      console.error('Error deleting event:', err);
      throw err;
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