'use client';

import React, { useState, useEffect, useMemo } from "react";
import { useEvents, Event, EventType } from "@/contexts/EventContext";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  GraduationCap,
  BookOpen, 
  BarChart2, 
  CalendarDays, 
  Users,
  Clock 
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, getMonth, getYear, isToday, isSameDay, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EventFormDialog } from "@/components/events/EventFormDialog";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { useTranslation } from "@/utils/translations";

export function CalendarView() {
  const { events } = useEvents();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  
  // 獲取當前月份的日期範圍
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // 獲取當前月份的第一天是星期幾（0 是星期日）
  const startDay = getDay(monthStart);
  
  // 計算日曆網格的行數
  const rows = Math.ceil((monthDays.length + startDay) / 7);
  
  // 為每天找到對應的事件
  const eventsMap = useMemo(() => {
    const map = new Map<string, Event[]>();
    
    monthDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayEvents = events.filter(event => {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        
        // 檢查該日期是否在事件的日期範圍內
        return (
          (day >= startDate && day <= endDate) || 
          format(startDate, 'yyyy-MM-dd') === dateStr || 
          format(endDate, 'yyyy-MM-dd') === dateStr
        );
      });
      
      map.set(dateStr, dayEvents);
    });
    
    return map;
  }, [events, monthDays]);
  
  // 獲取選定日期的事件
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return eventsMap.get(dateStr) || [];
  }, [selectedDate, eventsMap]);
  
  // 切換到上個月
  const prevMonth = () => {
    setCurrentDate(prev => subMonths(prev, 1));
  };
  
  // 切換到下個月
  const nextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };
  
  // 回到今天
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };
  
  // 處理日期點擊
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };
  
  // 處理事件點擊
  const handleEventClick = (event: Event) => {
    setEditingEvent(event);
    setIsFormOpen(true);
  };
  
  // 獲取事件類型圖標
  const getTypeIcon = (type: EventType) => {
    switch (type) {
      case 'course':
        return <GraduationCap className="h-3 w-3 text-blue-500" />;
      case 'workshop':
        return <BookOpen className="h-3 w-3 text-purple-500" />;
      case 'training':
        return <BarChart2 className="h-3 w-3 text-emerald-500" />;
      case 'planning':
        return <CalendarDays className="h-3 w-3 text-amber-500" />;
      case 'meeting':
        return <Users className="h-3 w-3 text-pink-500" />;
      default:
        return <CalendarIcon className="h-3 w-3 text-gray-500" />;
    }
  };
  
  // 獲取狀態顏色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'to_do':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'done':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  // 獲取狀態顯示名稱
  const getStatusName = (status: string) => {
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
  
  // 獲取優先級顏色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  // 截斷文字
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
  // 日曆網格渲染
  const renderCalendarGrid = () => {
    // 日期網格
    const calendarGrid: React.ReactNode[] = [];
    
    // 星期頭部
    const weekdays = [t('sunday'), t('monday'), t('tuesday'), t('wednesday'), t('thursday'), t('friday'), t('saturday')];
    const weekdayHeaders = (
      <div className="grid grid-cols-7 border-b pb-2 mb-2">
        {weekdays.map((day, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>
    );
    
    // 日期格子
    let dayGrid: React.ReactNode[] = [];
    let dayCounter = 0;
    
    // 添加空白格子直到月份開始的那一天
    for (let i = 0; i < startDay; i++) {
      dayGrid.push(
        <div key={`empty-${i}`} className="h-24 border-r border-b p-1"></div>
      );
      dayCounter++;
    }
    
    // 添加月份的天數
    monthDays.forEach((day, i) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayEvents = eventsMap.get(dateStr) || [];
      const isSelected = selectedDate && isSameDay(day, selectedDate);
      
      dayGrid.push(
        <div 
          key={dateStr}
          className={cn(
            "h-24 border-r border-b p-1 overflow-hidden relative",
            isToday(day) && "bg-blue-50",
            isSelected && "ring-2 ring-blue-500",
            dayCounter % 7 === 6 && "border-r-0", // 週六不顯示右邊框
            !isSameMonth(day, currentDate) && "opacity-50"
          )}
          onClick={() => handleDateClick(day)}
        >
          <div className="text-right mb-1">
            <span className={cn(
              "text-xs font-medium inline-block rounded-full w-5 h-5 text-center leading-5",
              isToday(day) && "bg-blue-500 text-white"
            )}>
              {format(day, 'd')}
            </span>
          </div>
          <div className="space-y-1 overflow-hidden max-h-[calc(100%-20px)]">
            {dayEvents.slice(0, 3).map((event, idx) => (
              <div 
                key={`${event.id}-${idx}`}
                className={cn(
                  "text-xs px-1 py-0.5 rounded cursor-pointer flex items-center gap-1",
                  getStatusColor(event.status)
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEventClick(event);
                }}
              >
                {getTypeIcon(event.type)}
                <span className="truncate">{truncateText(event.title, 15)}</span>
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-xs text-gray-500 pl-1">
                {t('more', { count: dayEvents.length - 3 })}
              </div>
            )}
          </div>
        </div>
      );
      dayCounter++;
      
      // 每週的最後一天添加換行
      if (dayCounter % 7 === 0 && dayCounter < monthDays.length + startDay) {
        calendarGrid.push(
          <div key={`week-${dayCounter / 7}`} className="grid grid-cols-7">
            {dayGrid}
          </div>
        );
        dayGrid = [];
      }
    });
    
    // 添加空格直到一週結束
    if (dayGrid.length > 0) {
      for (let i = dayGrid.length; i < 7; i++) {
        dayGrid.push(
          <div key={`empty-end-${i}`} className="h-24 border-r border-b p-1 opacity-50"></div>
        );
      }
      calendarGrid.push(
        <div key={`week-last`} className="grid grid-cols-7">
          {dayGrid}
        </div>
      );
    }
    
    return (
      <div className="border rounded-md overflow-hidden">
        {weekdayHeaders}
        {calendarGrid}
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-medium min-w-24 text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            {t('today')}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          {renderCalendarGrid()}
        </div>
        
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-2">
                {selectedDate ? format(selectedDate, t('selected_date_format')) : t('select_date')}
              </h3>
              
              {selectedDateEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateEvents.map(event => (
                    <Card key={event.id} className="shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeIcon(event.type)}
                          <span className="font-medium">{event.title}</span>
                        </div>
                        
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                          {event.description}
                        </p>
                        
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="outline" className={getStatusColor(event.status)}>
                            {getStatusName(event.status)}
                          </Badge>
                          
                          <Badge variant="outline" className={getPriorityColor(event.priority)}>
                            {t(event.priority as any)}
                          </Badge>
                          
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>
                              {format(new Date(event.startDate), "MMM dd")} - {format(new Date(event.endDate), "MMM dd")}
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-7"
                            onClick={() => handleEventClick(event)}
                          >
                            {t('view_details')}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 border rounded-md bg-gray-50">
                  <p className="text-gray-500">{t('no_events_today')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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