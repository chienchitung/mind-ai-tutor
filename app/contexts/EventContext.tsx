'use client';

import React, { createContext, useContext, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';

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

// The app currently uses a simplified data model with no separate tags table,
// so tags is always empty and views are a fixed, non-persisted default set.
const NO_TAGS: EventTag[] = [];

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
  updateEvents: (events: Event[]) => Promise<void>;
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

const EVENTS_QUERY_KEY = ['events'] as const;

async function fetchEvents(): Promise<Event[]> {
  const { supabase } = await import('@/lib/supabase');
  const supabaseClient = supabase();

  const { data, error } = await supabaseClient
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapSupabaseEventToEvent);
}

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const {
    data: events = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: EVENTS_QUERY_KEY,
    queryFn: fetchEvents,
  });

  const [activeView, setActiveView] = useState<EventViewType>('list');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [activeSort, setActiveSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'startDate',
    direction: 'asc'
  });

  // 添加過濾功能的狀態
  const [filterText, setFilterText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  // Add a new event
  const addMutation = useMutation({
    mutationFn: async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'attachments'> & { tagIds: string[] }) => {
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();

      const now = new Date().toISOString();
      const eventId = uuidv4();
      const selectedTags = eventData.tagIds
        ? NO_TAGS.filter(tag => eventData.tagIds.includes(tag.id))
        : [];

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

      const { error } = await supabaseClient.from('events').insert({
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
      });

      if (error) throw new Error(error.message);

      return newEvent;
    },
    onSuccess: (newEvent) => {
      queryClient.setQueryData<Event[]>(EVENTS_QUERY_KEY, (prev = []) => [...prev, newEvent]);
    },
  });

  // Update a single event
  const updateMutation = useMutation({
    mutationFn: async (event: Event) => {
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();

      const updatedEvent = { ...event, updatedAt: new Date().toISOString() };

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

      return updatedEvent;
    },
    onSuccess: (updatedEvent) => {
      queryClient.setQueryData<Event[]>(EVENTS_QUERY_KEY, (prev = []) =>
        prev.map(e => e.id === updatedEvent.id ? updatedEvent : e)
      );
    },
  });

  // Update several events at once (e.g. a drag-and-drop reorder that shifts
  // status/position for multiple sibling cards). Writes are fired concurrently;
  // the cache is updated once via a single functional setQueryData call, so
  // resolving writes can't race each other and clobber a sibling's change.
  const updateManyMutation = useMutation({
    mutationFn: async (updatedEvents: Event[]) => {
      if (updatedEvents.length === 0) return [];
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();
      const now = new Date().toISOString();
      const withTimestamp = updatedEvents.map(event => ({ ...event, updatedAt: now }));

      const results = await Promise.all(
        withTimestamp.map(async event => {
          const { error } = await supabaseClient.from('events').update({
            title: event.title,
            description: event.description,
            type: event.type,
            status: event.status,
            priority: event.priority,
            position: event.position,
            start_date: event.startDate,
            end_date: event.endDate,
            updated_at: event.updatedAt,
          }).eq('id', event.id);
          return { event, error };
        })
      );

      const succeeded = results.filter(r => !r.error).map(r => r.event);
      const failed = results.filter(r => r.error);

      if (succeeded.length > 0) {
        queryClient.setQueryData<Event[]>(EVENTS_QUERY_KEY, (prev = []) => {
          const updatedById = new Map(succeeded.map(e => [e.id, e]));
          return prev.map(e => updatedById.get(e.id) ?? e);
        });
      }

      if (failed.length > 0) {
        failed.forEach(f => console.error(`Error updating event ${f.event.id}:`, f.error?.message));
        throw new Error(`Failed to update ${failed.length} event(s)`);
      }

      return succeeded;
    },
  });

  // Delete an event
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { supabase } = await import('@/lib/supabase');
      const supabaseClient = supabase();

      // Validate if the ID exists in the database before trying to delete
      const { data: checkEvent } = await supabaseClient
        .from('events')
        .select('id')
        .eq('id', id)
        .single();

      if (checkEvent) {
        const { error } = await supabaseClient.from('events').delete().eq('id', id);
        if (error) throw new Error(error.message);
      }
    },
    onMutate: async (id: string) => {
      // Optimistically remove from the UI immediately.
      const previous = queryClient.getQueryData<Event[]>(EVENTS_QUERY_KEY);
      queryClient.setQueryData<Event[]>(EVENTS_QUERY_KEY, (prev = []) => prev.filter(e => e.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      console.error('Error deleting event:', err);
      // Restore the event if deletion failed.
      if (context?.previous) {
        queryClient.setQueryData<Event[]>(EVENTS_QUERY_KEY, context.previous);
      }
    },
  });

  const addEvent = async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'attachments'> & { tagIds: string[] }) => {
    await addMutation.mutateAsync(eventData);
  };

  const updateEvent = async (event: Event) => {
    await updateMutation.mutateAsync(event);
  };

  const updateEvents = async (updatedEvents: Event[]) => {
    await updateManyMutation.mutateAsync(updatedEvents);
  };

  const deleteEvent = async (id: string) => {
    // Matches prior behavior: the UI has already been updated optimistically,
    // so deletion failures are logged (and rolled back) rather than rethrown.
    await deleteMutation.mutateAsync(id).catch(() => {});
  };

  const value: EventContextType = {
    events,
    tags: NO_TAGS,
    views: DEFAULT_VIEWS,
    activeView,
    activeFilters,
    activeSort,
    isLoading,
    error: queryError ? (queryError as Error).message : null,
    addEvent,
    updateEvent,
    updateEvents,
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
