'use client';

import React, { useState, useEffect } from "react";
import { useEvents } from "@/contexts/EventContext";
import { 
  Calendar, 
  CalendarCheck, 
  ChevronLeft, 
  ChevronRight, 
  ArrowDown, 
  Edit, 
  Trash,
  GraduationCap,
  BookOpen,
  BarChart2,
  CalendarClock,
  Users,
  Clock
} from "lucide-react";
import { 
  format, 
  addDays, 
  subDays, 
  isSameDay, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  differenceInDays, 
  isBefore,
  isAfter,
  max,
  min
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Event, EventType } from "@/contexts/EventContext";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { EventFormDialog } from "../EventFormDialog";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

type TimelineViewMode = 'week' | 'month';

// 計算事件在時間軸上的位置和跨度
interface EventPosition {
  event: Event;
  startOffset: number; // 在當前視圖中的開始位置 (0-6 for week, 0-x for month)
  endOffset: number;   // 在當前視圖中的結束位置 (0-6 for week, 0-x for month)
  isPartial: boolean;  // 事件是否只有部分在視圖中顯示
  color: string;       // 事件顏色 (基於狀態)
}

export function TimelineView() {
  const { events, updateEvent, deleteEvent } = useEvents();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [focusDate, setFocusDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<TimelineViewMode>('week');
  const [timelineEvents, setTimelineEvents] = useState<Event[]>([]);
  const [positionedEvents, setPositionedEvents] = useState<EventPosition[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<Event[]>([]);
  const [isEventListOpen, setIsEventListOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // 獲取當前視圖的日期範圍
  const getDateRange = () => {
    let rangeStart: Date;
    let rangeEnd: Date;
    
    if (viewMode === 'week') {
      rangeStart = startOfWeek(focusDate, { weekStartsOn: 1 }); // Monday
      rangeEnd = endOfWeek(focusDate, { weekStartsOn: 1 }); // Sunday
    } else {
      rangeStart = startOfMonth(focusDate);
      rangeEnd = endOfMonth(focusDate);
    }
    
    return { rangeStart, rangeEnd };
  };
  
  // 獲取時間線上的所有日期
  const getTimelineDays = () => {
    const { rangeStart, rangeEnd } = getDateRange();
    return eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  };
  
  const days = getTimelineDays();
  const today = new Date();
  
  // 過濾並為事件計算位置信息
  useEffect(() => {
    const { rangeStart, rangeEnd } = getDateRange();
    
    // 過濾事件
    const filteredEvents = events.filter(event => {
      const eventStartDate = new Date(event.startDate);
      const eventEndDate = new Date(event.endDate);
      
      // 顯示在時間範圍內開始或結束，或橫跨時間範圍的事件
      return (
        (eventStartDate >= rangeStart && eventStartDate <= rangeEnd) || // 開始日期在範圍內
        (eventEndDate >= rangeStart && eventEndDate <= rangeEnd) || // 結束日期在範圍內
        (eventStartDate <= rangeStart && eventEndDate >= rangeEnd) // 事件橫跨整個範圍
      );
    });
    
    setTimelineEvents(filteredEvents);
    
    // 為每個事件計算位置信息
    const posEvents: EventPosition[] = filteredEvents.map(event => {
      const eventStartDate = new Date(event.startDate);
      const eventEndDate = new Date(event.endDate);
      
      // 計算事件在視圖中的實際開始日期 (可能在視圖外)
      const effectiveStartDate = max([eventStartDate, rangeStart]);
      const effectiveEndDate = min([eventEndDate, rangeEnd]);
      
      // 計算偏移量
      let startOffset = 0;
      let endOffset = 0;
      
      if (viewMode === 'week') {
        // 週視圖: 0-6，對應星期一至星期日
        startOffset = differenceInDays(effectiveStartDate, rangeStart);
        endOffset = differenceInDays(effectiveEndDate, rangeStart);
      } else {
        // 月視圖: 計算相對於月初的偏移
        // 考慮月初不是星期一的情況
        const firstDayOffset = startOfMonth(focusDate).getDay() === 0 ? 6 : startOfMonth(focusDate).getDay() - 1;
        startOffset = differenceInDays(effectiveStartDate, rangeStart) + firstDayOffset;
        endOffset = differenceInDays(effectiveEndDate, rangeStart) + firstDayOffset;
      }
      
      // 確定事件顏色 (基於狀態)
      const statusColors = {
        to_do: "bg-blue-100 border-blue-400 text-blue-800",
        in_progress: "bg-amber-100 border-amber-400 text-amber-800",
        done: "bg-green-100 border-green-400 text-green-800"
      };
      
      const color = statusColors[event.status] || "bg-gray-100 border-gray-400 text-gray-800";
      
      // 檢查事件是否完全在視圖範圍內
      const isPartial = isBefore(eventStartDate, rangeStart) || isAfter(eventEndDate, rangeEnd);
      
      return {
        event,
        startOffset: Math.max(0, startOffset),
        endOffset: Math.max(0, endOffset),
        isPartial,
        color
      };
    });
    
    setPositionedEvents(posEvents);
  }, [events, focusDate, viewMode]);
  
  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setIsFormOpen(true);
  };
  
  const navigatePrevious = () => {
    if (viewMode === 'week') {
      setFocusDate(subDays(focusDate, 7));
    } else {
      const newDate = new Date(focusDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setFocusDate(newDate);
    }
  };
  
  const navigateNext = () => {
    if (viewMode === 'week') {
      setFocusDate(addDays(focusDate, 7));
    } else {
      const newDate = new Date(focusDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setFocusDate(newDate);
    }
  };
  
  const navigateToday = () => {
    setFocusDate(new Date());
  };
  
  // Event type icons
  const typeIcons: Record<EventType, React.ReactNode> = {
    course: <GraduationCap className="h-4 w-4 text-blue-500" />,
    workshop: <BookOpen className="h-4 w-4 text-purple-500" />,
    training: <BarChart2 className="h-4 w-4 text-emerald-500" />,
    planning: <CalendarClock className="h-4 w-4 text-amber-500" />,
    meeting: <Users className="h-4 w-4 text-pink-500" />,
    other: <Calendar className="h-4 w-4 text-gray-500" />
  };
  
  // Priority and status colors
  const priorityColors = {
    high: "bg-red-100 text-red-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-green-100 text-green-800"
  };
  
  const statusColors = {
    to_do: "bg-blue-100 text-blue-800",
    in_progress: "bg-amber-100 text-amber-800",
    done: "bg-green-100 text-green-800"
  };
  
  // 獲取事件的實際長度
  const getEventDurationInDays = (event: Event) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return differenceInDays(end, start) + 1; // +1 因為結束日也算一天
  };
  
  // Get formatted title for the current view
  const getViewTitle = () => {
    if (viewMode === 'week') {
      const start = format(days[0], 'MMM d');
      const end = format(days[days.length - 1], 'MMM d, yyyy');
      return `${start} - ${end}`;
    } else {
      return format(focusDate, 'MMMM yyyy');
    }
  };
  
  // 新增：處理點擊「+X more」的函數
  const handleShowMoreEvents = (day: Date, events: Event[], e: React.MouseEvent) => {
    setSelectedDate(day);
    setSelectedDayEvents(events);
    setIsEventListOpen(true);
    // 阻止事件冒泡，防止觸發父元素的點擊事件
    e.stopPropagation();
  };
  
  return (
    <div className="flex flex-col space-y-4">
      {/* Timeline header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={navigateToday}>
            {t('today')}
          </Button>
          <Button variant="outline" size="sm" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h3 className="font-medium text-lg ml-2">{getViewTitle()}</h3>
        </div>
        
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as TimelineViewMode)}>
          <TabsList>
            <TabsTrigger value="week">{t('week')}</TabsTrigger>
            <TabsTrigger value="month">{t('month')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Timeline grid */}
      <div className="border rounded-md">
        {/* Days header */}
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {viewMode === 'week' && days.map((day, idx) => (
            <div 
              key={idx} 
              className={cn(
                "py-2 px-2 text-center font-medium border-r last:border-r-0",
                isSameDay(day, today) ? "bg-blue-50" : ""
              )}
            >
              <div className="text-sm">{format(day, 'EEE')}</div>
              <div className={cn(
                "inline-flex items-center justify-center h-6 w-6 rounded-full text-sm",
                isSameDay(day, today) ? "bg-blue-500 text-white" : ""
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
          
          {viewMode === 'month' && (
            <>
              {days.slice(0, 7).map((day, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "py-2 px-2 text-center font-medium border-r last:border-r-0",
                    isSameDay(day, today) ? "bg-blue-50" : ""
                  )}
                >
                  <div className="text-sm">{format(day, 'EEE')}</div>
                  <div className={cn(
                    "inline-flex items-center justify-center h-6 w-6 rounded-full text-sm",
                    isSameDay(day, today) ? "bg-blue-500 text-white" : ""
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        
        {/* Week view */}
        {viewMode === 'week' && (
          <div className="relative grid grid-cols-7 min-h-[600px]">
            {/* 背景格子 */}
            {days.map((day, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "p-1 border-r last:border-r-0 min-h-full",
                  isSameDay(day, today) ? "bg-blue-50/50" : ""
                )}
              >
                {/* 空白區域，使整體高度足夠 */}
              </div>
            ))}
            
            {/* 所有事件統一顯示 */}
            <div className="absolute top-0 left-0 w-full">
              {/* 將事件依照起始日期排序 */}
              {positionedEvents
                .sort((a, b) => {
                  // 先依照開始日期排序
                  const startDiff = new Date(a.event.startDate).getTime() - new Date(b.event.startDate).getTime();
                  if (startDiff !== 0) return startDiff;
                  // 如果開始日期相同，再依照結束日期排序
                  return new Date(a.event.endDate).getTime() - new Date(b.event.endDate).getTime();
                })
                .map((posEvent, eventIdx) => {
                  const { event, startOffset, endOffset, isPartial } = posEvent;
                  const colSpan = endOffset - startOffset + 1;
                  const leftPos = `${(startOffset / 7) * 100}%`;
                  const width = `${(colSpan / 7) * 100}%`;
                  const marginTop = `${eventIdx * 55}px`;  // 進一步增加垂直間距，從50px到55px
                  
                  // 交替背景色，隔行顯示不同底色
                  const isEvenRow = eventIdx % 2 === 0;
                  
                  return (
                    <div
                      key={event.id}
                      style={{
                        position: 'absolute',
                        left: leftPos,
                        width: width,
                        marginTop: marginTop
                      }}
                      className={cn(
                        "shadow hover:shadow-md transition-shadow", // 增加默認陰影
                        "p-0 rounded-md overflow-hidden cursor-pointer"
                      )}
                      onClick={() => handleEditEvent(event)}
                    >
                      <Card className={cn(
                        "p-0 h-full border",
                        isEvenRow ? "bg-white" : "bg-gray-50/40", // 交替底色
                      )}>
                        <CardContent className={cn(
                          "p-3 flex items-center gap-2 h-full",
                          isPartial && "rounded-none",
                          startOffset === 0 && isPartial && "rounded-l-none",
                          endOffset === 6 && isPartial && "rounded-r-none",
                          "border-l-4",
                          event.status === 'to_do' ? "border-l-blue-500" : 
                          event.status === 'in_progress' ? "border-l-amber-500" : "border-l-green-500"
                        )}>
                          {typeIcons[event.type]}
                          <span className="truncate text-sm font-medium">{event.title}</span>
                          <span className="whitespace-nowrap ml-auto flex items-center gap-0.5 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            {getEventDurationInDays(event)}d
                          </span>
                          
                          <div onClick={(e) => e.stopPropagation()} className="ml-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-gray-100">
                                <ArrowDown className="h-3 w-3" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditEvent(event)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  <span>Edit</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => deleteEvent(event.id)}
                                  className="text-red-600"
                                >
                                  <Trash className="mr-2 h-4 w-4" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
        
        {/* Month view */}
        {viewMode === 'month' && (
          <div className="grid grid-cols-7">
            {/* Calculate offset for the first day of the month */}
            {Array.from({ length: startOfMonth(focusDate).getDay() === 0 ? 6 : startOfMonth(focusDate).getDay() - 1 }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-24 bg-gray-50/50 border-r border-b"></div>
            ))}
            
            {/* Days of the month */}
            {days.map((day, idx) => {
              // 找到這一天開始的事件
              const dayEvents = timelineEvents.filter(event => 
                isSameDay(new Date(event.startDate), day)
              );
              
              // 找到在這一天中顯示的跨天事件
              const multiDayEventsForDay = positionedEvents
                .filter(pe => {
                  const dayOffset = differenceInDays(day, days[0]);
                  // 檢查當前日期是否在事件範圍內
                  return dayOffset >= pe.startOffset && dayOffset <= pe.endOffset;
                })
                .filter(pe => {
                  // 只在事件開始日顯示一次
                  const eventStartDate = new Date(pe.event.startDate);
                  return isSameDay(eventStartDate, day);
                });
              
              // 所有相關事件，同時包括當日開始的單日和跨日事件
              const allDayEvents = [...dayEvents, ...multiDayEventsForDay.map(pe => pe.event)];
              
              return (
                <div 
                  key={idx} 
                  className={cn(
                    "h-24 p-1 border-r border-b overflow-auto",
                    isSameDay(day, today) ? "bg-blue-50/50" : "",
                    (idx + 1) % 7 === 0 ? "border-r-0" : ""
                  )}
                >
                  <div className={cn(
                    "text-xs font-medium mb-1 flex justify-between items-center",
                    isSameDay(day, today) ? "text-blue-600" : ""
                  )}>
                    <span>{format(day, 'd')}</span>
                    {dayEvents.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-5">
                        {dayEvents.length}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {/* 跨天事件 */}
                    {multiDayEventsForDay.slice(0, 1).map(posEvent => {
                      const { event, isPartial, color } = posEvent;
                      const duration = getEventDurationInDays(event);
                      
                      return (
                        <div 
                          key={`multi-${event.id}`} 
                          className={cn(
                            "text-xs p-0.5 rounded cursor-pointer line-clamp-1 flex items-center gap-0.5",
                            color.split(' ')[0], // 使用背景顏色
                            "border-l-2",
                            `border-l-${event.status === 'to_do' ? 'blue' : event.status === 'in_progress' ? 'amber' : 'green'}-500`
                          )}
                          onClick={() => handleEditEvent(event)}
                        >
                          {typeIcons[event.type]}
                          <span className="truncate">{event.title}</span>
                          <span className="ml-auto text-[10px]">{duration}d</span>
                        </div>
                      );
                    })}
                    
                    {/* 單天事件 */}
                    {dayEvents
                      .filter(event => {
                        const startDate = new Date(event.startDate);
                        const endDate = new Date(event.endDate);
                        return isSameDay(startDate, endDate); // 只顯示單天事件
                      })
                      .slice(0, multiDayEventsForDay.length > 0 ? 1 : 2)
                      .map(event => (
                        <div 
                          key={event.id} 
                          className={cn(
                            "text-xs p-0.5 rounded cursor-pointer line-clamp-1 flex items-center gap-0.5",
                            statusColors[event.status].split(' ')[0] // 使用背景顏色
                          )}
                          onClick={() => handleEditEvent(event)}
                        >
                          {typeIcons[event.type]}
                          {event.title}
                        </div>
                      ))
                    }
                    
                    {/* 顯示"更多"提示 - 使其可點擊 */}
                    {(dayEvents.length + multiDayEventsForDay.length > 2 || 
                      (multiDayEventsForDay.length > 0 && dayEvents.length > 1)) && (
                      <div 
                        className="text-xs text-gray-500 pl-1 cursor-pointer hover:text-gray-700 hover:bg-gray-100 rounded px-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowMoreEvents(day, allDayEvents, e);
                        }}
                      >
                        +{dayEvents.length + multiDayEventsForDay.length - 
                           (multiDayEventsForDay.length > 0 ? 1 : 2)} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {isFormOpen && (
        <EventFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          initialEvent={editingEvent}
          mode="edit"
        />
      )}
      
      {/* 事件列表對話框 */}
      {isEventListOpen && selectedDate && (
        <Dialog open={isEventListOpen} onOpenChange={setIsEventListOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedDate ? format(selectedDate, t('selected_date_format')) : t('events')}
              </DialogTitle>
              <DialogDescription>
                {t('all_events_for_this_day')}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto p-1">
              <div className="space-y-2">
                {selectedDayEvents.map(event => (
                  <Card key={event.id} className="hover:shadow-md cursor-pointer" onClick={() => {
                    setIsEventListOpen(false);
                    handleEditEvent(event);
                  }}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        {typeIcons[event.type]}
                        <span className="font-medium">{event.title}</span>
                        <Badge className={cn(
                          "ml-auto",
                          event.status === 'to_do' ? "bg-blue-100 text-blue-800" : 
                          event.status === 'in_progress' ? "bg-amber-100 text-amber-800" : 
                          "bg-green-100 text-green-800"
                        )}>
                          {t(event.status)}
                        </Badge>
                      </div>
                      {event.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                      )}
                      <div className="flex items-center text-xs text-gray-500 mt-2">
                        <Clock className="h-3 w-3 mr-1" />
                        <span>
                          {format(new Date(event.startDate), "MMM dd")}
                          {!isSameDay(new Date(event.startDate), new Date(event.endDate)) && 
                           ` - ${format(new Date(event.endDate), "MMM dd")}`}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {selectedDayEvents.length === 0 && (
                  <div className="text-center py-4 text-gray-500">{t('no_events_for_this_day')}</div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEventListOpen(false)}>
                {t('close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 