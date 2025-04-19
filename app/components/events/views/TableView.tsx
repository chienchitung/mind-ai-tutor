'use client';

import React, { useState, useEffect } from "react";
import { useEvents } from "@/contexts/EventContext";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";
import { 
  ArrowUpDown, 
  MoreHorizontal, 
  Calendar,
  Clock,
  Edit,
  Trash,
  GraduationCap,
  BookOpen,
  BarChart2,
  CalendarClock,
  Users,
  Filter,
  X
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EventFormDialog } from "@/components/events/EventFormDialog";
import { Event, EventType, EventStatus, EventPriority, sortEvents } from "@/contexts/EventContext";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export function TableView() {
  const { events, updateEvent, deleteEvent } = useEvents();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'startDate',
    direction: 'asc'
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [filters, setFilters] = useState<{
    type: EventType[] | null,
    status: EventStatus[] | null,
    priority: EventPriority[] | null
  }>({
    type: null,
    status: null,
    priority: null
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  
  // 篩選事件
  const filteredEvents = events.filter(event => {
    if (filters.type && filters.type.length > 0 && !filters.type.includes(event.type)) {
      return false;
    }
    if (filters.status && filters.status.length > 0 && !filters.status.includes(event.status)) {
      return false;
    }
    if (filters.priority && filters.priority.length > 0 && !filters.priority.includes(event.priority)) {
      return false;
    }
    return true;
  });
  
  // 排序事件
  const sortedEvents = React.useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      let comparison = 0;
      
      switch (sortConfig.field) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'priority':
          // 按優先級順序排序: high > medium > low
          const priorityOrder: Record<EventPriority, number> = { high: 2, medium: 1, low: 0 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'startDate':
          comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case 'endDate':
          comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
          break;
        default:
          comparison = 0;
          break;
      }
      
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredEvents, sortConfig]);
  
  // 切換排序
  const handleSort = (field: string) => {
    setSortConfig({
      field,
      direction: sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };
  
  // 編輯事件
  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setIsFormOpen(true);
  };
  
  // 事件類型列表
  const eventTypes: EventType[] = ['course', 'workshop', 'training', 'planning', 'meeting', 'other'];
  
  // 事件狀態列表
  const eventStatuses: EventStatus[] = ['to_do', 'in_progress', 'done'];
  
  // 事件優先級列表
  const eventPriorities: EventPriority[] = ['high', 'medium', 'low'];
  
  // 重置篩選器
  const resetFilters = () => {
    setFilters({
      type: null,
      status: null,
      priority: null
    });
  };
  
  // 檢查是否有啟用篩選
  const hasActiveFilters = filters.type !== null || filters.status !== null || filters.priority !== null;
  
  // 切換類型篩選
  const toggleTypeFilter = (type: EventType) => {
    setFilters(prev => {
      if (!prev.type) {
        return { ...prev, type: [type] };
      }
      
      if (prev.type.includes(type)) {
        const newTypes = prev.type.filter(t => t !== type);
        return { ...prev, type: newTypes.length > 0 ? newTypes : null };
      } else {
        return { ...prev, type: [...prev.type, type] };
      }
    });
  };
  
  // 切換狀態篩選
  const toggleStatusFilter = (status: EventStatus) => {
    setFilters(prev => {
      if (!prev.status) {
        return { ...prev, status: [status] };
      }
      
      if (prev.status.includes(status)) {
        const newStatuses = prev.status.filter(s => s !== status);
        return { ...prev, status: newStatuses.length > 0 ? newStatuses : null };
      } else {
        return { ...prev, status: [...prev.status, status] };
      }
    });
  };
  
  // 切換優先級篩選
  const togglePriorityFilter = (priority: EventPriority) => {
    setFilters(prev => {
      if (!prev.priority) {
        return { ...prev, priority: [priority] };
      }
      
      if (prev.priority.includes(priority)) {
        const newPriorities = prev.priority.filter(p => p !== priority);
        return { ...prev, priority: newPriorities.length > 0 ? newPriorities : null };
      } else {
        return { ...prev, priority: [...prev.priority, priority] };
      }
    });
  };
  
  // 獲取狀態顏色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'to_do':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'in_progress':
        return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
      case 'done':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };
  
  // 獲取優先級顏色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
      case 'low':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };
  
  // 獲取事件類型圖標
  const getTypeIcon = (type: EventType) => {
    switch (type) {
      case 'course':
        return <GraduationCap className="h-4 w-4 text-blue-500" />;
      case 'workshop':
        return <BookOpen className="h-4 w-4 text-purple-500" />;
      case 'training':
        return <BarChart2 className="h-4 w-4 text-emerald-500" />;
      case 'planning':
        return <CalendarClock className="h-4 w-4 text-amber-500" />;
      case 'meeting':
        return <Users className="h-4 w-4 text-pink-500" />;
      default:
        return <Calendar className="h-4 w-4 text-gray-500" />;
    }
  };
  
  // 獲取事件類型顯示名稱
  const getTypeName = (type: EventType) => {
    return t(type as any);
  };
  
  // 獲取狀態顯示名稱
  const getStatusName = (status: EventStatus) => {
    switch (status) {
      case 'to_do':
        return t('to_do');
      case 'in_progress':
        return t('in_progress');
      case 'done':
        return t('done');
      default:
        return status;
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetFilters}
              className="h-8"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              <span>{t('events_clear_filters')}</span>
            </Button>
          )}
          
          <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className={cn("h-8", hasActiveFilters && "border-blue-500 text-blue-500")}
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                <span>{t('events_filter')}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">{t('type')}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {eventTypes.map(type => (
                      <div 
                        key={type} 
                        className={cn(
                          "px-2 py-1 rounded flex items-center gap-1.5 cursor-pointer text-xs",
                          filters.type?.includes(type) 
                            ? "bg-blue-100 text-blue-800" 
                            : "hover:bg-gray-100"
                        )}
                        onClick={() => toggleTypeFilter(type)}
                      >
                        {getTypeIcon(type)}
                        <span>{t(type as any)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">{t('status')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {eventStatuses.map(status => (
                      <div 
                        key={status} 
                        className={cn(
                          "px-2 py-1 rounded cursor-pointer text-xs",
                          filters.status?.includes(status) 
                            ? getStatusColor(status) 
                            : "hover:bg-gray-100"
                        )}
                        onClick={() => toggleStatusFilter(status)}
                      >
                        {getStatusName(status)}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">{t('priority')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {eventPriorities.map(priority => (
                      <div 
                        key={priority} 
                        className={cn(
                          "px-2 py-1 rounded cursor-pointer text-xs capitalize",
                          filters.priority?.includes(priority) 
                            ? getPriorityColor(priority) 
                            : "hover:bg-gray-100"
                        )}
                        onClick={() => togglePriorityFilter(priority)}
                      >
                        {t(priority as any)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="flex items-center space-x-2">
          {selectedEvents.length > 0 && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => {
                // 刪除選中的事件
                selectedEvents.forEach(id => deleteEvent(id));
                setSelectedEvents([]);
              }}
              className="h-8"
            >
              <Trash className="h-3.5 w-3.5 mr-1" />
              <span>{t('delete_selected', { count: selectedEvents.length })}</span>
            </Button>
          )}
        </div>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={selectedEvents.length === sortedEvents.length && sortedEvents.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedEvents(sortedEvents.map(e => e.id));
                    } else {
                      setSelectedEvents([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead className="w-12">{t('icon')}</TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  className="p-0 hover:bg-transparent hover:text-primary flex items-center"
                  onClick={() => handleSort('title')}
                >
                  {t('title')}
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell">
                <Button 
                  variant="ghost" 
                  className="p-0 hover:bg-transparent hover:text-primary flex items-center"
                  onClick={() => handleSort('type')}
                >
                  {t('type')}
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell">
                <Button 
                  variant="ghost" 
                  className="p-0 hover:bg-transparent hover:text-primary flex items-center"
                  onClick={() => handleSort('status')}
                >
                  {t('status')}
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="hidden md:table-cell">
                <Button 
                  variant="ghost" 
                  className="p-0 hover:bg-transparent hover:text-primary flex items-center"
                  onClick={() => handleSort('priority')}
                >
                  {t('priority')}
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  className="p-0 hover:bg-transparent hover:text-primary flex items-center"
                  onClick={() => handleSort('startDate')}
                >
                  {t('date_range')}
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  {hasActiveFilters ? t('no_activities_found') : t('no_upcoming_events')}
                </TableCell>
              </TableRow>
            ) : (
              sortedEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedEvents.includes(event.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedEvents([...selectedEvents, event.id]);
                        } else {
                          setSelectedEvents(selectedEvents.filter(id => id !== event.id));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {getTypeIcon(event.type)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {event.title}
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                      {event.description}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {t(event.type as any)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="secondary" className={cn(getStatusColor(event.status))}>
                      {getStatusName(event.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="secondary" className={cn(getPriorityColor(event.priority))}>
                      {t(event.priority as any)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span>{format(new Date(event.startDate), "MMM dd")} - {format(new Date(event.endDate), "MMM dd, yyyy")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(event)}>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>{t('edit')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => deleteEvent(event.id)}
                          className="text-red-600 cursor-pointer focus:text-red-600"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          <span>{t('delete')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {isFormOpen && (
        <EventFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          initialEvent={editingEvent}
          mode="edit"
        />
      )}
    </div>
  );
} 