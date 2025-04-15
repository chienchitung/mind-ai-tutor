'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';

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
        // Load tags
        const { data: tagsData, error: tagsError } = await supabase
          .from('event_tags')
          .select('id, name, color');
          
        if (tagsError) throw tagsError;
        setTags(tagsData || []);
        
        // Load events with their tags
        const { data: eventsData, error: eventsError } = await supabase
          .from('events_with_tags')
          .select('*');
          
        if (eventsError) throw eventsError;
        
        const mappedEvents = (eventsData || []).map(mapSupabaseEventToEvent);
        setEvents(mappedEvents);
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading data:", err);
        setError('Failed to load events');
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Add a new event
  const addEvent = async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'attachments'> & { tagIds: string[] }) => {
    try {
      // Insert the event into the events table
      const { data: newEvent, error } = await supabase
        .from('events')
        .insert({
          title: eventData.title,
          description: eventData.description,
          type: eventData.type,
          status: eventData.status,
          priority: eventData.priority,
          position: eventData.position,
          start_date: eventData.startDate,
          end_date: eventData.endDate
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // If tags are provided, link them to the event
      if (eventData.tagIds && eventData.tagIds.length > 0) {
        const tagLinks = eventData.tagIds.map(tagId => ({
          event_id: newEvent.id,
          tag_id: tagId
        }));
        
        const { error: tagsError } = await supabase
          .from('events_tags')
          .insert(tagLinks);
          
        if (tagsError) throw tagsError;
      }
      
      // Fetch the complete event with tags
      const { data: eventWithTags, error: fetchError } = await supabase
        .from('events_with_tags')
        .select('*')
        .eq('id', newEvent.id)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Update the local state
      const mappedEvent = mapSupabaseEventToEvent(eventWithTags);
      setEvents(prev => [...prev, mappedEvent]);
      
    } catch (err) {
      console.error("Error adding event:", err);
      throw err;
    }
  };

  // Update an existing event
  const updateEvent = async (event: Event) => {
    try {
      // Create update object with correct column names
      const updateData: Record<string, any> = {};
      
      if (event.title !== undefined) updateData.title = event.title;
      if (event.description !== undefined) updateData.description = event.description;
      if (event.type !== undefined) updateData.type = event.type;
      if (event.status !== undefined) updateData.status = event.status;
      if (event.priority !== undefined) updateData.priority = event.priority;
      if (event.position !== undefined) updateData.position = event.position;
      if (event.startDate !== undefined) updateData.start_date = event.startDate;
      if (event.endDate !== undefined) updateData.end_date = event.endDate;
      
      // Only update if there's data to update
      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('events')
          .update(updateData)
          .eq('id', event.id);
          
        if (error) throw error;
      }
      
      // If tags are provided, update the event-tag relationships
      if (event.tags && event.tags.length > 0) {
        // First remove all existing tag links
        const { error: deleteError } = await supabase
          .from('events_tags')
          .delete()
          .eq('event_id', event.id);
          
        if (deleteError) throw deleteError;
        
        // Then add the new ones
        const tagLinks = event.tags.map(tag => ({
          event_id: event.id,
          tag_id: tag.id
        }));
        
        const { error: insertError } = await supabase
          .from('events_tags')
          .insert(tagLinks);
          
        if (insertError) throw insertError;
      }
      
      // Fetch the updated event with tags
      const { data: updatedEvent, error: fetchError } = await supabase
        .from('events_with_tags')
        .select('*')
        .eq('id', event.id)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Update the local state
      const mappedEvent = mapSupabaseEventToEvent(updatedEvent);
      setEvents(prev => prev.map(event => 
        event.id === mappedEvent.id ? mappedEvent : event
      ));
      
    } catch (err) {
      console.error("Error updating event:", err);
      throw err;
    }
  };

  // Delete an event
  const deleteEvent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state
      setEvents(prev => prev.filter(event => event.id !== id));
      
    } catch (err) {
      console.error("Error deleting event:", err);
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